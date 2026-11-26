-- 033 assessment rules: close the gaps between what the app shows and what the database enforces.
--
-- 1. QUIZ TIME LIMIT (was not enforced at all). quizzes.time_limit_min was written by save_quiz and
--    counted down by the app, but submit_quiz never looked at it, and the countdown lived in a
--    module-level Map in quiz-take-screen.tsx -- so closing and reopening the app handed out a fresh
--    full timer. There was also no server record of when a student started: submit_quiz took
--    p_started_at from the client.
--    Now public.start_quiz() opens (or resumes) the attempt and stamps started_at from the DB clock,
--    and submit_quiz measures against that row. See "the consequence" below.
--
-- 2. ANSWER KEY (migration 008 can_see_answer_key). The two conditions were OR-ed, so the key became
--    readable as soon as due_at passed even with attempts remaining: on a multi-attempt quiz with a
--    late window a student could submit once, read every correct_index, and submit again perfectly.
--    Now a quiz that still accepts attempts keeps its key.
--
-- 3. GRADING ERRORS. grade_assignment and grade_quiz_attempt passed p_score straight to a CHECK
--    constraint, so an out-of-range score reached the instructor as SQLSTATE 23514 and the portal's
--    generic failure. They validate and explain now.
--
-- 4. SUBMIT/GRADE RACE. submit_assignment read the row, decided it was not graded, then upserted
--    without re-checking -- so a grade landing in between was kept while the student's edit went
--    through on top of it. The upsert now carries the guard.
--
-- EXISTING DATA. One nullable-with-default column is added (over_time). No row is rewritten and no
-- existing attempt or submission changes meaning.

-- ---------------------------------------------------------------- 1. time limit
-- Parallel to `late` in migration 011: stamped by the database from ITS clock, never from the client.
alter table public.quiz_attempts
  add column if not exists over_time boolean not null default false;

comment on column public.quiz_attempts.over_time is
  'True when the attempt was submitted more than the quiz''s time_limit_min (plus grace) after the '
  'server-recorded started_at. The answers are kept and scored; what an over-time attempt is worth '
  'is the instructor''s call.';

-- Opens the attempt, or resumes the one already open, and reports the clock the client must show.
-- Resuming matters: without it, reopening the screen would start a new attempt and burn max_attempts.
create or replace function public.start_quiz(p_quiz_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q public.quizzes; me uuid := auth.uid(); a public.quiz_attempts; n int; max_s numeric;
begin
  select * into q from public.quizzes
   where id = p_quiz_id and deleted_at is null and status = 'published';
  if q.id is null or not private.is_class_member(q.class_id) then
    raise exception 'quiz not found' using errcode = 'P0002';
  end if;

  -- Same window the stamp_attempt_late trigger (011) applies on submit, refused earlier and in words.
  if q.due_at is not null and now() > q.due_at
     and (not q.allow_late or (q.closes_at is not null and now() > q.closes_at)) then
    raise exception 'this quiz is closed' using errcode = '23514';
  end if;

  select * into a from public.quiz_attempts
   where quiz_id = q.id and student_id = me and submitted_at is null
   order by started_at desc limit 1;

  if a.id is null then
    select count(*) into n from public.quiz_attempts where quiz_id = q.id and student_id = me;
    if n >= q.max_attempts then raise exception 'no attempts left' using errcode = '23505'; end if;
    select coalesce(sum(points), 0) into max_s from public.quiz_questions where quiz_id = q.id;
    -- attempt_no collides under a double tap; unique (quiz_id, student_id, attempt_no) refuses the
    -- loser rather than handing out an extra attempt, and the client simply retries.
    insert into public.quiz_attempts (quiz_id, student_id, attempt_no, started_at, max_score)
    values (q.id, me, n + 1, now(), max_s)
    returning * into a;
  end if;

  return jsonb_build_object(
    'attemptId', a.id,
    'startedAt', a.started_at,
    'serverTime', now(),
    'secondsLeft', case when q.time_limit_min is null then null
                   else greatest(0, ceil(extract(epoch from
                          (a.started_at + make_interval(mins => q.time_limit_min) - now()))))::int end);
end $$;

revoke execute on function public.start_quiz(text) from public, anon;
grant  execute on function public.start_quiz(text) to authenticated;

-- Creating an attempt is now start_quiz's job only. The direct-insert policy also let a client choose
-- its own started_at, which is exactly what the time limit may not depend on.
drop policy if exists qa_insert on public.quiz_attempts;
revoke insert on public.quiz_attempts from authenticated;

-- Replaces submit_quiz from migration 017. Scoring is unchanged; what is new is that it finalises the
-- attempt start_quiz opened, measures the time limit against that row, and upserts the answers.
create or replace function public.submit_quiz(p_quiz_id text, p_answers jsonb, p_started_at timestamptz default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare q public.quizzes; me uuid := auth.uid(); n int; aid text; max_s numeric; auto_s numeric := 0;
        has_essay boolean; r record; idx int; ok boolean; pts numeric;
        a public.quiz_attempts; v_over boolean := false;
        grace constant interval := interval '2 minutes';  -- clock skew, slow upload, a backgrounded app
begin
  select * into q from public.quizzes where id = p_quiz_id and deleted_at is null and status = 'published';
  if q.id is null or not private.is_class_member(q.class_id) then
    raise exception 'quiz not found' using errcode = 'P0002';
  end if;
  select coalesce(sum(points), 0), coalesce(bool_or(type = 'essay'), false) into max_s, has_essay
    from public.quiz_questions where quiz_id = q.id;

  -- The attempt start_quiz opened. p_started_at is ignored: it is a client value, and a client may
  -- not decide when its own timer began.
  select * into a from public.quiz_attempts
   where quiz_id = q.id and student_id = me and submitted_at is null
   order by started_at desc limit 1;

  if a.id is null then
    -- No open attempt: an app build that predates start_quiz, so there is no trustworthy start time
    -- and the time limit cannot be enforced for this submission. Required-update (settings.system.update,
    -- migration 027) is how that tail is retired.
    select count(*) into n from public.quiz_attempts where quiz_id = q.id and student_id = me;
    if n >= q.max_attempts then raise exception 'already submitted' using errcode = '23505'; end if;
    insert into public.quiz_attempts (quiz_id, student_id, attempt_no, started_at, max_score)
    values (q.id, me, n + 1, now(), max_s)
    returning * into a;
  else
    v_over := q.time_limit_min is not null
              and now() > a.started_at + make_interval(mins => q.time_limit_min) + grace;
    update public.quiz_attempts set max_score = max_s where id = a.id;  -- questions may have changed
  end if;
  aid := a.id;

  for r in
    select qq.id, qq.type, qq.points, k.correct_index, k.correct_answer,
           (select e from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) e
             where e ->> 'question_id' = qq.id limit 1) as el
      from public.quiz_questions qq
      left join public.quiz_question_keys k on k.question_id = qq.id
     where qq.quiz_id = q.id
  loop
    idx := case when (r.el ->> 'index') ~ '^[0-9]{1,3}$' then (r.el ->> 'index')::int end;
    ok := case r.type
            when 'multiple_choice' then idx is not null and idx = r.correct_index
            when 'identification'  then r.correct_answer is not null
                                        and lower(btrim(coalesce(r.el ->> 'text', ''))) = lower(btrim(r.correct_answer))
            else null end;
    pts := case when ok is null then null when ok then r.points else 0 end;
    auto_s := auto_s + coalesce(pts, 0);
    -- Upsert, not insert: the attempt is open before the submit now, and a row may already exist.
    insert into public.quiz_answers (attempt_id, question_id, response_index, response_text, is_correct, awarded_points)
    values (aid, r.id,
            case when r.type = 'multiple_choice' then idx end,
            case when r.type <> 'multiple_choice' then left(r.el ->> 'text', 10000) end,
            ok, pts)
    on conflict (attempt_id, question_id) do update set
      response_index = excluded.response_index,
      response_text  = excluded.response_text,
      is_correct     = excluded.is_correct,
      awarded_points = excluded.awarded_points;
  end loop;

  update public.quiz_attempts
     set submitted_at = now(), score = auto_s, over_time = v_over,
         graded_at = case when has_essay then null else now() end
   where id = aid;
  return aid;
end $$;

-- ---------------------------------------------------------------- 2. answer key
-- A student sees the key once they are finished with the quiz. "Finished" means out of attempts, or
-- past due AND no longer able to start another one -- not merely past due.
create or replace function private.can_see_answer_key(qid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.quizzes q
    where q.id = qid and q.deleted_at is null
      and exists (select 1 from public.quiz_attempts a
                  where a.quiz_id = q.id and a.student_id = (select auth.uid()) and a.submitted_at is not null)
      and (
        -- out of attempts
        (select count(*) from public.quiz_attempts a
          where a.quiz_id = q.id and a.student_id = (select auth.uid()) and a.submitted_at is not null)
          >= q.max_attempts
        -- or the quiz accepts nothing further from anyone
        or (q.due_at is not null and now() > q.due_at
            and (not q.allow_late or (q.closes_at is not null and now() > q.closes_at)))
      )
  )
$$;

-- ---------------------------------------------------------------- 3. grading errors
create or replace function public.grade_assignment(p_assignment_id text, p_student_id uuid, p_score numeric, p_feedback text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_points smallint;
begin
  if not private.is_class_owner(private.assignment_class(p_assignment_id)) then
    raise exception 'not the class owner' using errcode = '42501';
  end if;
  select points into v_points from public.assignments where id = p_assignment_id and deleted_at is null;
  if v_points is null then raise exception 'assignment not found' using errcode = 'P0002'; end if;
  if p_score is null or p_score < 0 or p_score > v_points then
    raise exception 'The score must be between 0 and %.', v_points using errcode = '22023';
  end if;
  update public.assignment_submissions
     set status = 'graded', score = p_score, feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
         graded_at = now(), graded_by = auth.uid()
   where assignment_id = p_assignment_id and student_id = p_student_id and status <> 'draft';
  if not found then raise exception 'nothing to grade' using errcode = 'P0002'; end if;
end $$;

create or replace function public.grade_quiz_attempt(p_attempt_id text, p_score numeric, p_feedback text) returns void
language plpgsql security definer set search_path = '' as $$
declare cid text; v_max numeric;
begin
  select private.quiz_class(quiz_id), max_score into cid, v_max
    from public.quiz_attempts where id = p_attempt_id;
  if cid is null or not private.is_class_owner(cid) then
    raise exception 'not the class owner' using errcode = '42501';
  end if;
  if p_score is null or p_score < 0 or p_score > v_max then
    raise exception 'The score must be between 0 and %.', v_max using errcode = '22023';
  end if;
  update public.quiz_attempts
     set score = p_score, feedback = coalesce(btrim(p_feedback), ''), graded_at = now(), graded_by = auth.uid()
   where id = p_attempt_id and submitted_at is not null;
  if not found then raise exception 'nothing to grade' using errcode = 'P0002'; end if;
end $$;

-- ---------------------------------------------------------------- 4. submit/grade race
-- Replaces submit_assignment from migration 020. Same rules; the "not graded yet" check is now part
-- of the write instead of a separate read, so a grade that commits in between wins cleanly.
create or replace function public.submit_assignment(p_assignment_id text, p_text text, p_file_id text,
                                         p_turn_in boolean default true)
returns public.submission_status
language plpgsql security definer set search_path = '' as $$
declare a public.assignments; s public.assignment_submissions; me uuid := auth.uid();
        overdue boolean; closed boolean; st public.submission_status; v_out public.submission_status;
begin
  select * into a from public.assignments where id = p_assignment_id and deleted_at is null;
  if a.id is null or not private.is_class_member(a.class_id) then
    raise exception 'assignment not found' using errcode = 'P0002';
  end if;
  if not private.owns_file(p_file_id) then
    raise exception 'file not yours' using errcode = '42501';
  end if;
  overdue := now() > a.due_at;
  closed  := overdue and (not a.allow_late or (a.closes_at is not null and now() > a.closes_at));
  select * into s from public.assignment_submissions where assignment_id = a.id and student_id = me;
  if s.id is not null and (s.status = 'graded' or s.score is not null) then
    raise exception 'already graded' using errcode = '23505';
  end if;
  if s.id is not null and s.status <> 'draft' and closed then
    raise exception 'deadline passed' using errcode = '23505';
  end if;
  if p_turn_in and not closed then
    st := case when overdue then 'late' else 'submitted' end;
  else
    st := 'draft';
  end if;
  insert into public.assignment_submissions (assignment_id, student_id, status, submission_text, file_id, submitted_at)
  values (a.id, me, st, nullif(btrim(coalesce(p_text, '')), ''), p_file_id,
          case when st = 'draft' then null else now() end)
  on conflict (assignment_id, student_id) do update set
    status          = excluded.status,
    -- null means "keep" (turning in a draft); a string, even empty, replaces the note
    submission_text = case when p_text is null then public.assignment_submissions.submission_text
                           else nullif(btrim(p_text), '') end,
    file_id         = coalesce(excluded.file_id, public.assignment_submissions.file_id),
    submitted_at    = excluded.submitted_at
    -- The guard the read above only predicted: a grade that arrived in the meantime is not overwritten.
    where public.assignment_submissions.status <> 'graded'
      and public.assignment_submissions.score is null
  returning status into v_out;
  if v_out is null then
    raise exception 'already graded' using errcode = '23505';
  end if;
  return v_out;
end $$;
