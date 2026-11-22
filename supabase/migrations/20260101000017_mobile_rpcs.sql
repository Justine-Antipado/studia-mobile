-- 017 mobile RPCs, notification triggers, storage policies.
-- The mobile app talks to Supabase directly. Anything a client may NOT do with plain table writes
-- (turn in work, submit + auto-grade a quiz, grade, save a quiz atomically) is a SECURITY DEFINER
-- function that re-checks ownership/membership itself. Notifications are created by triggers.

-- ================================================================ notification helpers
create function private.class_student_ids(cid text) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(e.student_id), '{}')
  from public.class_enrollments e
  join public.users u on u.id = e.student_id and u.status = 'active' and u.deleted_at is null
  where e.class_id = cid and e.left_at is null
$$;

create function private.notify_users(p_users uuid[], p_kind public.notification_kind, p_title text,
                                     p_meta text, p_body text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link_params)
  select distinct u, p_kind, left(btrim(p_title), 140), left(coalesce(p_body, ''), 500),
         jsonb_build_object('meta', coalesce(p_meta, ''))
  from unnest(p_users) as u
  where u is not null and char_length(btrim(p_title)) > 0
$$;

create function private.class_code(cid text) returns text
language sql stable security definer set search_path = '' as $$
  select subject_code from public.classes where id = cid
$$;
create function private.class_owner_id(cid text) returns uuid
language sql stable security definer set search_path = '' as $$
  select instructor_id from public.classes where id = cid
$$;
create function private.person_name(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(full_name, 'Someone') from public.users where id = uid
$$;

-- ---------------------------------------------------------------- triggers
create function private.trg_notify_announcement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_users(private.class_student_ids(new.class_id), 'notice', new.title,
                               private.class_code(new.class_id), left(new.body, 280));
  return null;
end $$;
create trigger trg_notify_announcement after insert on public.announcements
  for each row execute function private.trg_notify_announcement();

create function private.trg_notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a public.announcements; audience uuid[];
begin
  select * into a from public.announcements where id = new.announcement_id;
  select array_agg(distinct x) into audience from (
    select a.author_id as x
    union select c.author_id from public.announcement_comments c where c.announcement_id = a.id
  ) s where x is not null and x is distinct from new.author_id;
  perform private.notify_users(coalesce(audience, '{}'), 'class', 'New comment on "' || a.title || '"',
                               private.person_name(new.author_id) || ' · ' || private.class_code(a.class_id),
                               left(new.body, 280));
  return null;
end $$;
create trigger trg_notify_comment after insert on public.announcement_comments
  for each row execute function private.trg_notify_comment();

create function private.trg_notify_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify_users(private.class_student_ids(new.class_id), 'reminder', 'New assignment: ' || new.title,
                                 private.class_code(new.class_id) || ' · ' || new.points || ' points',
                                 left(new.instructions, 280));
  elsif new.due_at is distinct from old.due_at then
    perform private.notify_users(private.class_student_ids(new.class_id), 'reminder', 'Due date changed: ' || new.title,
                                 private.class_code(new.class_id),
                                 'The new due date is ' || to_char(new.due_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM') || '.');
  end if;
  return null;
end $$;
create trigger trg_notify_assignment after insert or update of due_at on public.assignments
  for each row execute function private.trg_notify_assignment();

create function private.trg_notify_quiz() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    perform private.notify_users(private.class_student_ids(new.class_id), 'quiz', 'New quiz: ' || new.title,
                                 private.class_code(new.class_id),
                                 case when new.due_at is null then null
                                      else 'Due ' || to_char(new.due_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM') || '.' end);
  end if;
  return null;
end $$;
create trigger trg_notify_quiz after insert or update of status on public.quizzes
  for each row execute function private.trg_notify_quiz();

create function private.trg_notify_material() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.processing = 'ready' and old.processing <> 'ready' then
    perform private.notify_users(private.class_student_ids(new.class_id), 'lesson', 'New lesson: ' || new.title,
                                 private.class_code(new.class_id), null);
  end if;
  return null;
end $$;
create trigger trg_notify_material after update of processing on public.materials
  for each row execute function private.trg_notify_material();

-- Materials uploaded from the app have no AI worker yet: they are readable immediately. A pasted
-- transcript (set_material_transcript) fills the transcript; summaries come from the AI service.
create function private.trg_material_autoready() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.materials set processing = 'ready' where id = new.id;
  return null;
end $$;
create trigger trg_material_autoready after insert on public.materials
  for each row execute function private.trg_material_autoready();

create function private.trg_notify_enroll() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.left_at is null and (tg_op = 'INSERT' or old.left_at is not null) then
    perform private.notify_users(array[private.class_owner_id(new.class_id)], 'class',
                                 private.person_name(new.student_id) || ' joined your class',
                                 private.class_code(new.class_id), null);
  end if;
  return null;
end $$;
create trigger trg_notify_enroll after insert or update of left_at on public.class_enrollments
  for each row execute function private.trg_notify_enroll();

create function private.trg_notify_submission() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a public.assignments;
begin
  select * into a from public.assignments where id = new.assignment_id;
  if new.status in ('submitted', 'late') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.notify_users(array[private.class_owner_id(a.class_id)], 'grade',
                                 private.person_name(new.student_id) || ' turned in ' || a.title,
                                 private.class_code(a.class_id) || case when new.status = 'late' then ' · Late' else '' end, null);
  elsif new.status = 'graded' and (tg_op = 'INSERT' or old.status is distinct from 'graded' or old.score is distinct from new.score) then
    perform private.notify_users(array[new.student_id], 'grade', a.title || ' graded',
                                 'You scored ' || new.score || '/' || a.points || ' · ' || private.class_code(a.class_id),
                                 new.feedback);
  end if;
  return null;
end $$;
create trigger trg_notify_submission after insert or update of status, score on public.assignment_submissions
  for each row execute function private.trg_notify_submission();

create function private.trg_notify_attempt() returns trigger
language plpgsql security definer set search_path = '' as $$
declare q public.quizzes;
begin
  select * into q from public.quizzes where id = new.quiz_id;
  if new.submitted_at is not null and old.submitted_at is null then
    perform private.notify_users(array[private.class_owner_id(q.class_id)], 'grade',
                                 private.person_name(new.student_id) || ' submitted ' || q.title,
                                 private.class_code(q.class_id) || case when new.late then ' · Late' else '' end, null);
  end if;
  if new.graded_by is not null and new.graded_at is not null and old.graded_at is distinct from new.graded_at then
    perform private.notify_users(array[new.student_id], 'grade', q.title || ' graded',
                                 'You scored ' || new.score || '/' || new.max_score || ' · ' || private.class_code(q.class_id),
                                 nullif(new.feedback, ''));
  end if;
  return null;
end $$;
create trigger trg_notify_attempt after update of submitted_at, graded_at on public.quiz_attempts
  for each row execute function private.trg_notify_attempt();

-- ================================================================ assignments
create function public.submit_assignment(p_assignment_id text, p_text text, p_file_id text,
                                         p_turn_in boolean default true)
returns public.submission_status
language plpgsql security definer set search_path = '' as $$
declare a public.assignments; s public.assignment_submissions; me uuid := auth.uid();
        overdue boolean; closed boolean; st public.submission_status;
begin
  select * into a from public.assignments where id = p_assignment_id and deleted_at is null;
  if a.id is null or not private.is_class_member(a.class_id) then
    raise exception 'assignment not found' using errcode = 'P0002';
  end if;
  if not private.owns_file(p_file_id) then
    raise exception 'file not yours' using errcode = '42501';
  end if;
  select * into s from public.assignment_submissions where assignment_id = a.id and student_id = me;
  if s.id is not null and s.status <> 'draft' then
    raise exception 'already turned in' using errcode = '23505';
  end if;
  overdue := now() > a.due_at;
  closed  := overdue and (not a.allow_late or (a.closes_at is not null and now() > a.closes_at));
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
    submission_text = coalesce(excluded.submission_text, public.assignment_submissions.submission_text),
    file_id         = coalesce(excluded.file_id, public.assignment_submissions.file_id),
    submitted_at    = excluded.submitted_at;
  return st;
end $$;

create function public.grade_assignment(p_assignment_id text, p_student_id uuid, p_score numeric, p_feedback text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_class_owner(private.assignment_class(p_assignment_id)) then
    raise exception 'not the class owner' using errcode = '42501';
  end if;
  update public.assignment_submissions
     set status = 'graded', score = p_score, feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
         graded_at = now(), graded_by = auth.uid()
   where assignment_id = p_assignment_id and student_id = p_student_id and status <> 'draft';
  if not found then raise exception 'nothing to grade' using errcode = 'P0002'; end if;
end $$;

-- ================================================================ quizzes
-- p_answers: [{"question_id": "...", "index": 2} | {"question_id": "...", "text": "..."}]
create function public.submit_quiz(p_quiz_id text, p_answers jsonb, p_started_at timestamptz default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare q public.quizzes; me uuid := auth.uid(); n int; aid text; max_s numeric; auto_s numeric := 0;
        has_essay boolean; r record; idx int; ok boolean; pts numeric;
begin
  select * into q from public.quizzes where id = p_quiz_id and deleted_at is null and status = 'published';
  if q.id is null or not private.is_class_member(q.class_id) then
    raise exception 'quiz not found' using errcode = 'P0002';
  end if;
  select count(*) into n from public.quiz_attempts where quiz_id = q.id and student_id = me;
  if n >= q.max_attempts then raise exception 'already submitted' using errcode = '23505'; end if;
  select coalesce(sum(points), 0), coalesce(bool_or(type = 'essay'), false) into max_s, has_essay
    from public.quiz_questions where quiz_id = q.id;

  insert into public.quiz_attempts (quiz_id, student_id, attempt_no, started_at, max_score)
  values (q.id, me, n + 1, least(coalesce(p_started_at, now()), now()), max_s)
  returning id into aid;

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
    insert into public.quiz_answers (attempt_id, question_id, response_index, response_text, is_correct, awarded_points)
    values (aid, r.id,
            case when r.type = 'multiple_choice' then idx end,
            case when r.type <> 'multiple_choice' then left(r.el ->> 'text', 10000) end,
            ok, pts);
  end loop;

  update public.quiz_attempts
     set submitted_at = now(), score = auto_s, graded_at = case when has_essay then null else now() end
   where id = aid;
  return aid;
end $$;

create function public.grade_quiz_attempt(p_attempt_id text, p_score numeric, p_feedback text) returns void
language plpgsql security definer set search_path = '' as $$
declare cid text;
begin
  select private.quiz_class(quiz_id) into cid from public.quiz_attempts where id = p_attempt_id;
  if cid is null or not private.is_class_owner(cid) then
    raise exception 'not the class owner' using errcode = '42501';
  end if;
  update public.quiz_attempts
     set score = p_score, feedback = coalesce(btrim(p_feedback), ''), graded_at = now(), graded_by = auth.uid()
   where id = p_attempt_id and submitted_at is not null;
  if not found then raise exception 'nothing to grade' using errcode = 'P0002'; end if;
end $$;

-- p_quiz: {id?, class_id, title, status, source, time_limit_min, due_at, allow_late, closes_at,
--          questions: [{type, prompt, options[], correct_index, correct_answer, bloom, difficulty, points, rationale}]}
-- One transaction, so the deferred answer-key checks see the whole question.
create function public.save_quiz(p_quiz jsonb, p_replace_questions boolean default true) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); qid text := nullif(p_quiz ->> 'id', ''); cid text := p_quiz ->> 'class_id';
        pub boolean := (p_quiz ->> 'status') = 'published'; old public.quizzes; qn jsonb; nq text; pos int := 0;
        fresh boolean := false;
begin
  if cid is null or not private.is_class_owner(cid) then
    raise exception 'not the class owner' using errcode = '42501';
  end if;
  if qid is null then
    fresh := true;
    insert into public.quizzes (class_id, title, status, source, time_limit_min, due_at, allow_late, closes_at,
                                created_by, published_at)
    values (cid, p_quiz ->> 'title',
            case when pub then 'published' else 'draft' end::public.quiz_status,
            coalesce(p_quiz ->> 'source', 'manual')::public.quiz_source,
            nullif(p_quiz ->> 'time_limit_min', '')::smallint,
            nullif(p_quiz ->> 'due_at', '')::timestamptz,
            coalesce((p_quiz ->> 'allow_late')::boolean, false),
            nullif(p_quiz ->> 'closes_at', '')::timestamptz,
            me, case when pub then now() end)
    returning id into qid;
  else
    select * into old from public.quizzes where id = qid and class_id = cid and deleted_at is null;
    if old.id is null then raise exception 'quiz not found' using errcode = 'P0002'; end if;
    update public.quizzes set
      title = p_quiz ->> 'title',
      status = case when pub then 'published' else 'draft' end::public.quiz_status,
      time_limit_min = nullif(p_quiz ->> 'time_limit_min', '')::smallint,
      due_at = nullif(p_quiz ->> 'due_at', '')::timestamptz,
      allow_late = coalesce((p_quiz ->> 'allow_late')::boolean, false),
      closes_at = nullif(p_quiz ->> 'closes_at', '')::timestamptz,
      published_at = case when pub then coalesce(old.published_at, now()) end
    where id = qid;
    if p_replace_questions then delete from public.quiz_questions where quiz_id = qid; end if;
  end if;

  if fresh or p_replace_questions then
    for qn in select * from jsonb_array_elements(coalesce(p_quiz -> 'questions', '[]'::jsonb)) loop
      pos := pos + 1;
      nq := gen_random_uuid()::text;
      insert into public.quiz_questions (id, quiz_id, position, type, prompt, bloom, difficulty, points)
      values (nq, qid, pos, (qn ->> 'type')::public.question_type, qn ->> 'prompt',
              nullif(qn ->> 'bloom', '')::public.bloom_level, nullif(qn ->> 'difficulty', '')::public.difficulty_level,
              coalesce((qn ->> 'points')::smallint, 1));
      if jsonb_typeof(qn -> 'options') = 'array' then
        insert into public.quiz_options (question_id, position, body)
        select nq, (o.ord - 1)::smallint, o.body from jsonb_array_elements_text(qn -> 'options') with ordinality as o(body, ord);
      end if;
      insert into public.quiz_question_keys (question_id, correct_index, correct_answer, rationale)
      values (nq, nullif(qn ->> 'correct_index', '')::smallint, nullif(qn ->> 'correct_answer', ''),
              nullif(qn ->> 'rationale', ''));
    end loop;
  end if;
  return qid;
end $$;

-- ================================================================ materials
create function public.set_material_transcript(p_material_id text, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare cid text; chunk text; i int := 0;
begin
  select class_id into cid from public.materials where id = p_material_id and deleted_at is null;
  if cid is null or not private.is_class_owner(cid) then
    raise exception 'not the class owner' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_text, ''))) < 20 or char_length(p_text) > 50000 then
    raise exception 'invalid transcript' using errcode = '23514';
  end if;
  delete from public.material_transcript_lines where material_id = p_material_id;
  for chunk in select btrim(x) from regexp_split_to_table(p_text, E'\n+') as x where btrim(x) <> '' loop
    insert into public.material_transcript_lines (material_id, start_sec, body)
    values (p_material_id, i * 20, left(chunk, 2000));
    i := i + 1;
  end loop;
end $$;

-- ================================================================ analytics (instructor)
create function public.instructor_analytics() returns jsonb
language sql stable security definer set search_path = '' as $$
  with mine as (
    select id, subject_code from public.classes
     where instructor_id = auth.uid() and deleted_at is null and not archived
  ),
  enr as (
    select e.class_id, e.student_id from public.class_enrollments e join mine m on m.id = e.class_id
     where e.left_at is null
  ),
  eng as (
    select m.id, m.subject_code,
           coalesce(round(100.0 * count(*) filter (where active) / nullif(count(*), 0)), 0)::int as pct
      from mine m
      join lateral (
        select exists (select 1 from public.material_views v join public.materials mt on mt.id = v.material_id
                        where mt.class_id = m.id and v.student_id = en.student_id and v.last_seen_at > now() - interval '14 days')
            or exists (select 1 from public.assignment_submissions s join public.assignments a on a.id = s.assignment_id
                        where a.class_id = m.id and s.student_id = en.student_id and s.created_at > now() - interval '14 days')
            or exists (select 1 from public.quiz_attempts t join public.quizzes z on z.id = t.quiz_id
                        where z.class_id = m.id and t.student_id = en.student_id and t.started_at > now() - interval '14 days') as active
          from enr en where en.class_id = m.id
      ) act on true
     group by m.id, m.subject_code
  ),
  cons as (
    select mt.title, m.subject_code,
           coalesce(round(100.0 * (select count(*) from public.material_views v where v.material_id = mt.id)
                          / nullif((select count(*) from enr where enr.class_id = m.id), 0)), 0)::int as pct
      from public.materials mt join mine m on m.id = mt.class_id
     where mt.deleted_at is null and mt.processing = 'ready'
     order by mt.posted_at desc limit 10
  ),
  stru as (
    select qq.concept, m.subject_code,
           round(100.0 * count(*) filter (where not a.is_correct) / count(*))::int as pct
      from public.quiz_answers a
      join public.quiz_questions qq on qq.id = a.question_id and qq.concept is not null
      join public.quizzes z on z.id = qq.quiz_id
      join mine m on m.id = z.class_id
     where a.is_correct is not null
     group by qq.concept, m.subject_code
     order by pct desc limit 5
  )
  select jsonb_build_object(
    'engagement',  coalesce((select jsonb_agg(jsonb_build_object('classCode', subject_code, 'engagementPercent', pct) order by pct desc) from eng), '[]'::jsonb),
    'consumption', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'classCode', subject_code, 'viewRatePercent', pct)) from cons), '[]'::jsonb),
    'struggling',  coalesce((select jsonb_agg(jsonb_build_object('concept', concept, 'classCode', subject_code, 'missRatePercent', pct)) from stru), '[]'::jsonb)
  )
$$;


-- ================================================================ class people (student "People" tab)
-- A student can not read other students' enrolment rows, so classmates come through this function.
create function public.class_classmates(p_class_id text) returns table (id uuid, full_name text)
language sql stable security definer set search_path = '' as $$
  select u.id, u.full_name
    from public.class_enrollments e
    join public.users u on u.id = e.student_id and u.deleted_at is null
   where e.class_id = p_class_id and e.left_at is null
     and e.student_id <> (select auth.uid())
     and private.can_access_class(p_class_id)
   order by u.full_name
$$;
revoke execute on function public.class_classmates(text) from public, anon;
grant execute on function public.class_classmates(text) to authenticated;

-- ================================================================ grants
revoke execute on function
  public.submit_assignment(text, text, text, boolean), public.grade_assignment(text, uuid, numeric, text),
  public.submit_quiz(text, jsonb, timestamptz), public.grade_quiz_attempt(text, numeric, text),
  public.save_quiz(jsonb, boolean), public.set_material_transcript(text, text), public.instructor_analytics()
  from public, anon;
grant execute on function
  public.submit_assignment(text, text, text, boolean), public.grade_assignment(text, uuid, numeric, text),
  public.submit_quiz(text, jsonb, timestamptz), public.grade_quiz_attempt(text, numeric, text),
  public.save_quiz(jsonb, boolean), public.set_material_transcript(text, text), public.instructor_analytics()
  to authenticated;

-- ================================================================ storage (private buckets)
-- Objects live under "<user id>/<random name>". Readers are resolved through public.files.
create policy "studia_upload_own_folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('materials', 'submissions') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "studia_read_shared" on storage.objects for select to authenticated
  using (bucket_id in ('materials', 'submissions') and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.files f
                where f.bucket = bucket_id and f.object_path = name and private.can_read_file(f.id))));
create policy "studia_delete_own" on storage.objects for delete to authenticated
  using (bucket_id in ('materials', 'submissions') and (storage.foldername(name))[1] = (select auth.uid())::text);
