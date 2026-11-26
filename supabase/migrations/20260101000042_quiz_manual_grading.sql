-- 042 quiz manual grading: identification stops auto-finalizing, and essay/identification points
-- are set per question instead of as one holistic number for the whole attempt.
--
-- THE GAP. submit_quiz (033) only held an attempt open for grading when it contained an ESSAY
-- question (`has_essay`); an identification question is auto-scored by exact string match and that
-- was treated as final the moment the student submitted -- graded_at was stamped immediately, and
-- the student saw a score with no instructor ever having looked at it. grade_quiz_attempt (033) then
-- only ever wrote one aggregate score for the whole attempt: there was no way to award points
-- question by question, even though quiz_answers.awarded_points (migration 004) already exists and
-- is already populated per question by submit_quiz for multiple_choice and identification.
--
-- THE FIX.
--   1. submit_quiz now holds graded_at = null whenever the quiz has an essay OR an identification
--      question (`has_manual`, was `has_essay`). The per-question auto-grading is unchanged --
--      identification still gets a suggested is_correct/awarded_points from the exact-match check --
--      but it is no longer the final word until an instructor turns the grade in.
--   2. grade_quiz_question(attempt, question, points) lets the instructor set or correct the points
--      of one essay or identification answer (multiple_choice stays auto-graded only; this function
--      refuses it).
--   3. release_quiz_grade(attempt, feedback) is the "Turn in": it requires every essay/identification
--      answer to already have awarded_points set, then sums every question's awarded_points into
--      quiz_attempts.score and stamps graded_at -- which is also the only thing that reveals the
--      score to the student (quizzes-remote.ts hides score/feedback while graded_at is null).
--   grade_quiz_attempt (033) is dropped: it wrote one holistic score and nothing calls it any more.
--
-- EXISTING DATA. No column changes. An attempt already sitting with graded_at set from an
-- identification-only quiz (auto-finalized under the old rule) is not revisited -- its grade stands;
-- only attempts submitted after this migration follow the new rule.

-- ---------------------------------------------------------------- 1. submit_quiz: has_manual
create or replace function public.submit_quiz(p_quiz_id text, p_answers jsonb, p_started_at timestamptz default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare q public.quizzes; me uuid := auth.uid(); n int; aid text; max_s numeric; auto_s numeric := 0;
        has_manual boolean; r record; idx int; ok boolean; pts numeric;
        a public.quiz_attempts; v_over boolean := false;
        grace constant interval := interval '2 minutes';  -- clock skew, slow upload, a backgrounded app
begin
  select * into q from public.quizzes where id = p_quiz_id and deleted_at is null and status = 'published';
  if q.id is null or not private.is_class_member(q.class_id) then
    raise exception 'quiz not found' using errcode = 'P0002';
  end if;
  select coalesce(sum(points), 0), coalesce(bool_or(type in ('essay', 'identification')), false)
    into max_s, has_manual
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
         graded_at = case when has_manual then null else now() end
   where id = aid;
  return aid;
end $$;

-- ---------------------------------------------------------------- 2. per-question grading
create or replace function public.grade_quiz_question(p_attempt_id text, p_question_id text, p_points numeric)
returns void
language plpgsql security definer set search_path = '' as $$
declare cid text; v_type public.question_type; v_max smallint;
begin
  select private.quiz_class(a.quiz_id) into cid from public.quiz_attempts a where a.id = p_attempt_id;
  if cid is null or not private.is_class_owner(cid) then
    raise exception 'not the class owner' using errcode = '42501';
  end if;

  select qq.type, qq.points into v_type, v_max
    from public.quiz_questions qq
    join public.quiz_attempts a on a.quiz_id = qq.quiz_id
   where qq.id = p_question_id and a.id = p_attempt_id;
  if v_type is null then raise exception 'question not found' using errcode = 'P0002'; end if;
  if v_type not in ('essay', 'identification') then
    raise exception 'this question is graded automatically' using errcode = '42501';
  end if;
  if p_points is null or p_points < 0 or p_points > v_max then
    raise exception 'The points must be between 0 and %.', v_max using errcode = '22023';
  end if;

  update public.quiz_answers
     set awarded_points = p_points, is_correct = (p_points >= v_max)
   where attempt_id = p_attempt_id and question_id = p_question_id;
  if not found then raise exception 'answer not found' using errcode = 'P0002'; end if;
end $$;

revoke execute on function public.grade_quiz_question(text, text, numeric) from public, anon;
grant  execute on function public.grade_quiz_question(text, text, numeric) to authenticated;

-- ---------------------------------------------------------------- 3. release ("Turn in")
create or replace function public.release_quiz_grade(p_attempt_id text, p_feedback text)
returns void
language plpgsql security definer set search_path = '' as $$
declare cid text; v_total numeric; v_ungraded int;
begin
  select private.quiz_class(quiz_id) into cid from public.quiz_attempts where id = p_attempt_id;
  if cid is null or not private.is_class_owner(cid) then
    raise exception 'not the class owner' using errcode = '42501';
  end if;

  -- Client already checks this (a clearer message there); kept here too as the backstop every
  -- SECURITY DEFINER write in this file has, in case a future caller skips the client check.
  select count(*) into v_ungraded
    from public.quiz_answers qa
    join public.quiz_questions qq on qq.id = qa.question_id
   where qa.attempt_id = p_attempt_id
     and qq.type in ('essay', 'identification')
     and qa.awarded_points is null;
  if v_ungraded > 0 then
    raise exception 'Every question needs points before this grade can be released.' using errcode = '22023';
  end if;

  select coalesce(sum(awarded_points), 0) into v_total from public.quiz_answers where attempt_id = p_attempt_id;

  update public.quiz_attempts
     set score = v_total, feedback = coalesce(btrim(p_feedback), ''), graded_at = now(), graded_by = auth.uid()
   where id = p_attempt_id and submitted_at is not null;
  if not found then raise exception 'nothing to grade' using errcode = 'P0002'; end if;
end $$;

revoke execute on function public.release_quiz_grade(text, text) from public, anon;
grant  execute on function public.release_quiz_grade(text, text) to authenticated;

-- ---------------------------------------------------------------- drop the superseded RPC
drop function if exists public.grade_quiz_attempt(text, numeric, text);
