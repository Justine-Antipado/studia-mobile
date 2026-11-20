-- 004 assessments: assignments, submissions, quizzes, attempts.
-- Answer keys live in their own table so a student can never read them early.

create type public.submission_status as enum ('draft', 'submitted', 'late', 'graded');
create type public.quiz_status       as enum ('draft', 'published');
create type public.quiz_source       as enum ('manual', 'ai');
create type public.question_type     as enum ('multiple_choice', 'identification', 'essay');
create type public.bloom_level       as enum ('Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create');
create type public.difficulty_level  as enum ('Easy', 'Medium', 'Hard');

-- ---------------------------------------------------------------- assignments
create table public.assignments (
  id           text primary key default gen_random_uuid()::text,
  class_id     text not null references public.classes (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 140),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  due_at       timestamptz not null,
  points       smallint not null default 0 check (points >= 0),
  -- allow_late = false: past due the work stays a draft and can still be turned in by the API
  allow_late   boolean not null default true,
  created_by   uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index ix_assignments_class on public.assignments (class_id, due_at);
create trigger trg_assignments_updated before update on public.assignments
  for each row execute function public.set_updated_at();

create table public.assignment_attachments (
  assignment_id text not null references public.assignments (id) on delete cascade,
  file_id       text not null references public.files (id) on delete cascade,
  position      smallint not null default 0,
  primary key (assignment_id, file_id)
);
create index ix_asg_attach_file on public.assignment_attachments (file_id);

create table public.assignment_submissions (
  id              text primary key default gen_random_uuid()::text,
  assignment_id   text not null references public.assignments (id) on delete cascade,
  student_id      uuid not null references public.users (id) on delete cascade,
  status          public.submission_status not null default 'draft',
  submission_text text,
  file_id         text references public.files (id) on delete set null,
  submitted_at    timestamptz,
  score           numeric(6,2) check (score >= 0),
  feedback        text check (char_length(feedback) <= 2000),
  graded_at       timestamptz,
  graded_by       uuid references public.users (id) on delete set null,
  idempotency_key text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (assignment_id, student_id),
  check (status = 'draft' or submitted_at is not null),
  check (status <> 'graded' or (score is not null and graded_at is not null))
);
create index ix_asub_student on public.assignment_submissions (student_id, status);
create index ix_asub_grading on public.assignment_submissions (status, submitted_at);
create index ix_asub_file    on public.assignment_submissions (file_id);
create trigger trg_asub_updated before update on public.assignment_submissions
  for each row execute function public.set_updated_at();

-- score <= assignments.points
create function private.check_submission_score() returns trigger
language plpgsql set search_path = '' as $$
declare max_points smallint;
begin
  if new.score is not null then
    select points into max_points from public.assignments where id = new.assignment_id;
    if new.score > max_points then
      raise exception 'score % exceeds assignment points %', new.score, max_points using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger trg_asub_score before insert or update on public.assignment_submissions
  for each row execute function private.check_submission_score();

create function private.assignment_class(aid text) returns text
language sql stable security definer set search_path = '' as $$
  select class_id from public.assignments where id = aid
$$;
grant execute on function private.assignment_class(text) to authenticated, service_role;

-- ---------------------------------------------------------------- quizzes
create table public.quizzes (
  id                 text primary key default gen_random_uuid()::text,
  class_id           text not null references public.classes (id) on delete cascade,
  title              text not null check (char_length(btrim(title)) between 1 and 140),
  status             public.quiz_status not null default 'draft',
  source             public.quiz_source not null default 'manual',
  time_limit_min     smallint check (time_limit_min > 0),
  due_at             timestamptz,
  max_attempts       smallint not null default 1 check (max_attempts >= 1),
  source_material_id text references public.materials (id) on delete set null,
  created_by         uuid references public.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  published_at       timestamptz,
  deleted_at         timestamptz,
  check (status = 'draft' or published_at is not null)
);
create index ix_quizzes_class    on public.quizzes (class_id, status);
create index ix_quizzes_source   on public.quizzes (source);
create index ix_quizzes_material on public.quizzes (source_material_id);

create table public.quiz_questions (
  id         text primary key default gen_random_uuid()::text,
  quiz_id    text not null references public.quizzes (id) on delete cascade,
  position   smallint not null default 0 check (position >= 0),
  type       public.question_type not null,
  prompt     text not null check (char_length(btrim(prompt)) between 1 and 1000),
  bloom      public.bloom_level,
  difficulty public.difficulty_level,
  points     smallint not null default 1 check (points >= 0),
  concept    text check (char_length(concept) <= 120)
);
create index ix_questions_quiz    on public.quiz_questions (quiz_id, position);
create index ix_questions_concept on public.quiz_questions (concept);

create table public.quiz_options (
  id          text primary key default gen_random_uuid()::text,
  question_id text not null references public.quiz_questions (id) on delete cascade,
  position    smallint not null check (position >= 0),
  body        text not null check (char_length(body) between 1 and 500),
  unique (question_id, position)
);

-- answer key + rationale: owner always, students only after submitting an attempt
create table public.quiz_question_keys (
  question_id    text primary key references public.quiz_questions (id) on delete cascade,
  correct_index  smallint check (correct_index >= 0),
  correct_answer text check (char_length(correct_answer) <= 255),
  rationale      text check (char_length(rationale) <= 1000)
);

-- multiple_choice needs correct_index inside its option range; checked at commit
-- so a question, its options and its key can be inserted in any order.
create function private.check_question_key(qid text) returns void
language plpgsql set search_path = '' as $$
declare qtype public.question_type; opt_count int; key_row public.quiz_question_keys;
begin
  select type into qtype from public.quiz_questions where id = qid;
  if qtype is null then return; end if;  -- question deleted in the same transaction
  select * into key_row from public.quiz_question_keys where question_id = qid;
  if qtype = 'multiple_choice' then
    select count(*) into opt_count from public.quiz_options where question_id = qid;
    if key_row.correct_index is null or key_row.correct_index >= opt_count then
      raise exception 'question % (multiple_choice): correct_index % outside % options',
        qid, key_row.correct_index, opt_count using errcode = '23514';
    end if;
  end if;
end $$;
create function private.trg_check_question_key() returns trigger
language plpgsql set search_path = '' as $$
declare r jsonb;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  perform private.check_question_key(
    case tg_table_name when 'quiz_questions' then r ->> 'id' else r ->> 'question_id' end);
  return null;
end $$;
create constraint trigger trg_chk_key_question after insert or update on public.quiz_questions
  deferrable initially deferred for each row execute function private.trg_check_question_key();
create constraint trigger trg_chk_key_key after insert or update or delete on public.quiz_question_keys
  deferrable initially deferred for each row execute function private.trg_check_question_key();
create constraint trigger trg_chk_key_option after insert or update or delete on public.quiz_options
  deferrable initially deferred for each row execute function private.trg_check_question_key();

create table public.quiz_attempts (
  id              text primary key default gen_random_uuid()::text,
  quiz_id         text not null references public.quizzes (id) on delete cascade,
  student_id      uuid not null references public.users (id) on delete cascade,
  attempt_no      smallint not null default 1 check (attempt_no >= 1),
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  score           numeric(6,2) check (score >= 0),
  max_score       numeric(6,2) not null default 0 check (max_score >= 0),
  graded_at       timestamptz,
  graded_by       uuid references public.users (id) on delete set null,
  feedback        text not null default '' check (char_length(feedback) <= 2000),
  idempotency_key text,
  unique (quiz_id, student_id, attempt_no),
  check (score is null or score <= max_score)
);
create index ix_qattempts_student on public.quiz_attempts (student_id, submitted_at);
create index ix_qattempts_grading on public.quiz_attempts (graded_at, submitted_at);

create function private.check_attempt_limit() returns trigger
language plpgsql set search_path = '' as $$
declare lim smallint;
begin
  select max_attempts into lim from public.quizzes where id = new.quiz_id;
  if new.attempt_no > lim then
    raise exception 'attempt % exceeds max_attempts %', new.attempt_no, lim using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_attempt_limit before insert on public.quiz_attempts
  for each row execute function private.check_attempt_limit();

create table public.quiz_answers (
  id             text primary key default gen_random_uuid()::text,
  attempt_id     text not null references public.quiz_attempts (id) on delete cascade,
  question_id    text not null references public.quiz_questions (id) on delete cascade,
  response_index smallint check (response_index >= 0),
  response_text  text check (char_length(response_text) <= 10000),
  is_correct     boolean,
  awarded_points numeric(6,2) check (awarded_points >= 0),
  unique (attempt_id, question_id)
);
create index ix_answers_question on public.quiz_answers (question_id);

create function private.check_awarded_points() returns trigger
language plpgsql set search_path = '' as $$
declare max_points smallint;
begin
  if new.awarded_points is not null then
    select points into max_points from public.quiz_questions where id = new.question_id;
    if new.awarded_points > max_points then
      raise exception 'awarded_points % exceeds question points %', new.awarded_points, max_points
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger trg_answer_points before insert or update on public.quiz_answers
  for each row execute function private.check_awarded_points();

-- ---------------------------------------------------------------- helpers
create function private.quiz_class(qid text) returns text
language sql stable security definer set search_path = '' as $$
  select class_id from public.quizzes where id = qid
$$;
create function private.question_quiz(qid text) returns text
language sql stable security definer set search_path = '' as $$
  select quiz_id from public.quiz_questions where id = qid
$$;
create function private.attempt_owner_open(aid text) returns boolean  -- caller's own, unsubmitted attempt
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.quiz_attempts
                 where id = aid and student_id = (select auth.uid()) and submitted_at is null)
$$;
create function private.can_read_quiz(qid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.quizzes q
    where q.id = qid and q.deleted_at is null
      and (private.is_class_owner(q.class_id) or private.is_admin()
           or (q.status = 'published' and private.is_class_member(q.class_id)))
  )
$$;
create function private.has_submitted_quiz(qid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.quiz_attempts
                 where quiz_id = qid and student_id = (select auth.uid()) and submitted_at is not null)
$$;
-- a student may read a file attached to material/assignment/submission they can see
create function private.can_read_file(fid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.materials m where m.file_id = fid and private.can_read_material(m.id))
      or exists (select 1 from public.assignment_attachments aa
                 join public.assignments a on a.id = aa.assignment_id and a.deleted_at is null
                 where aa.file_id = fid and private.can_access_class(a.class_id))
      or exists (select 1 from public.assignment_submissions s
                 join public.assignments a on a.id = s.assignment_id
                 where s.file_id = fid
                   and (s.student_id = (select auth.uid()) or private.is_class_owner(a.class_id)))
$$;
grant execute on function private.assignment_class(text), private.quiz_class(text), private.question_quiz(text),
  private.attempt_owner_open(text), private.can_read_quiz(text), private.has_submitted_quiz(text),
  private.can_read_file(text) to authenticated, service_role;

-- ---------------------------------------------------------------- RLS
alter table public.assignments            enable row level security;
alter table public.assignment_attachments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.quizzes                enable row level security;
alter table public.quiz_questions         enable row level security;
alter table public.quiz_options           enable row level security;
alter table public.quiz_question_keys     enable row level security;
alter table public.quiz_attempts          enable row level security;
alter table public.quiz_answers           enable row level security;

create policy files_select_shared on public.files for select to authenticated
  using (private.can_read_file(id));

create policy asg_select on public.assignments for select to authenticated
  using (deleted_at is null and private.can_access_class(class_id));
create policy asg_write on public.assignments for all to authenticated
  using (private.is_class_owner(class_id))
  with check (private.is_class_owner(class_id) and created_by = (select auth.uid()));

create policy asgatt_select on public.assignment_attachments for select to authenticated
  using (private.can_access_class(private.assignment_class(assignment_id)));
create policy asgatt_write on public.assignment_attachments for all to authenticated
  using (private.is_class_owner(private.assignment_class(assignment_id)))
  with check (private.is_class_owner(private.assignment_class(assignment_id)));

-- students edit their own DRAFT only; turn-in (late rule) and grading go through the API/RPC
create policy asub_select on public.assignment_submissions for select to authenticated
  using (student_id = (select auth.uid())
         or private.is_class_owner(private.assignment_class(assignment_id))
         or (select private.is_admin()));
create policy asub_insert on public.assignment_submissions for insert to authenticated
  with check (student_id = (select auth.uid()) and status = 'draft' and score is null
              and graded_at is null and submitted_at is null
              and private.is_class_member(private.assignment_class(assignment_id)));
create policy asub_update on public.assignment_submissions for update to authenticated
  using (student_id = (select auth.uid()) and status = 'draft')
  with check (student_id = (select auth.uid()) and status = 'draft' and score is null and graded_at is null);
revoke update on public.assignment_submissions from authenticated;
grant update (submission_text, file_id) on public.assignment_submissions to authenticated;

create policy quiz_select on public.quizzes for select to authenticated
  using (private.can_read_quiz(id));
create policy quiz_write on public.quizzes for all to authenticated
  using (private.is_class_owner(class_id))
  with check (private.is_class_owner(class_id) and created_by = (select auth.uid()));

create policy qq_select on public.quiz_questions for select to authenticated
  using (private.can_read_quiz(quiz_id));
create policy qq_write on public.quiz_questions for all to authenticated
  using (private.is_class_owner(private.quiz_class(quiz_id)))
  with check (private.is_class_owner(private.quiz_class(quiz_id)));
create policy qo_select on public.quiz_options for select to authenticated
  using (private.can_read_quiz(private.question_quiz(question_id)));
create policy qo_write on public.quiz_options for all to authenticated
  using (private.is_class_owner(private.quiz_class(private.question_quiz(question_id))))
  with check (private.is_class_owner(private.quiz_class(private.question_quiz(question_id))));
create policy qk_select on public.quiz_question_keys for select to authenticated
  using (private.is_class_owner(private.quiz_class(private.question_quiz(question_id)))
         or private.has_submitted_quiz(private.question_quiz(question_id)));
create policy qk_write on public.quiz_question_keys for all to authenticated
  using (private.is_class_owner(private.quiz_class(private.question_quiz(question_id))))
  with check (private.is_class_owner(private.quiz_class(private.question_quiz(question_id))));

-- attempts: students start and answer; scoring/submission/grading run server-side
create policy qa_select on public.quiz_attempts for select to authenticated
  using (student_id = (select auth.uid())
         or private.is_class_owner(private.quiz_class(quiz_id))
         or (select private.is_admin()));
create policy qa_insert on public.quiz_attempts for insert to authenticated
  with check (student_id = (select auth.uid()) and submitted_at is null and score is null
              and graded_at is null and private.can_read_quiz(quiz_id)
              and private.is_class_member(private.quiz_class(quiz_id)));
revoke update, delete on public.quiz_attempts from authenticated;

create policy ans_select on public.quiz_answers for select to authenticated
  using (exists (select 1 from public.quiz_attempts a
                 where a.id = attempt_id
                   and (a.student_id = (select auth.uid())
                        or private.is_class_owner(private.quiz_class(a.quiz_id))
                        or (select private.is_admin()))));
create policy ans_insert on public.quiz_answers for insert to authenticated
  with check (private.attempt_owner_open(attempt_id) and is_correct is null and awarded_points is null);
create policy ans_update on public.quiz_answers for update to authenticated
  using (private.attempt_owner_open(attempt_id))
  with check (private.attempt_owner_open(attempt_id) and is_correct is null and awarded_points is null);
revoke update on public.quiz_answers from authenticated;
grant update (response_index, response_text) on public.quiz_answers to authenticated;
