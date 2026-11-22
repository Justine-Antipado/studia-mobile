-- 011 assessment schedule: late window for assignments and quizzes, late flag on quiz attempts,
-- and the server-side rules the mobile mock already follows (docs/api-contract.md, "Assessment rules").
--
--   assignments.closes_at   last moment a LATE turn-in is accepted (needs allow_late)
--   quizzes.allow_late      late attempts accepted after due_at
--   quizzes.closes_at       last moment any attempt is accepted (needs allow_late)
--   quiz_attempts.late      stamped by the database from ITS clock, never from the client
--
-- Rules enforced here (the client copy is only for fast feedback):
--   1. closes_at >= due_at, and closes_at only exists when allow_late is true.
--   2. A quiz attempt cannot be submitted after due_at unless allow_late, nor after closes_at.
--      A late submit is tagged late = true using now() (device clocks are not trusted).
--   3. Once any attempt exists, questions / options / answer keys of that quiz are frozen.
--   4. assignments.points cannot drop below a score that was already given.
--   5. Moving assignments.due_at re-tags turned-in work: submitted <-> late. Graded rows stay graded.

-- ---------------------------------------------------------------- assignments
alter table public.assignments
  add column closes_at timestamptz;

alter table public.assignments
  add constraint assignments_closes_after_due check (closes_at is null or closes_at >= due_at),
  add constraint assignments_closes_needs_late check (closes_at is null or allow_late);

-- ---------------------------------------------------------------- quizzes
alter table public.quizzes
  add column allow_late boolean not null default false,
  add column closes_at  timestamptz;

alter table public.quizzes
  add constraint quizzes_closes_after_due check (closes_at is null or (due_at is not null and closes_at >= due_at)),
  add constraint quizzes_closes_needs_late check (closes_at is null or allow_late);

alter table public.quiz_attempts
  add column late boolean not null default false;

-- Reject a closed quiz and stamp late attempts. Runs when an attempt goes from open to submitted.
create function private.stamp_attempt_late() returns trigger
language plpgsql set search_path = '' as $$
declare q public.quizzes;
begin
  if new.submitted_at is null or (tg_op = 'UPDATE' and old.submitted_at is not null) then
    return new;
  end if;
  select * into q from public.quizzes where id = new.quiz_id;
  if q.due_at is not null and now() > q.due_at then
    if not q.allow_late or (q.closes_at is not null and now() > q.closes_at) then
      raise exception 'quiz % is closed', new.quiz_id using errcode = '23514';
    end if;
    new.late := true;
  else
    new.late := false;
  end if;
  return new;
end $$;
create trigger trg_attempt_late before insert or update of submitted_at on public.quiz_attempts
  for each row execute function private.stamp_attempt_late();

-- Freeze questions once students have taken the quiz. pg_trigger_depth() > 1 lets the FK cascade
-- that deletes a whole quiz (and its attempts) through.
create function private.assert_quiz_unlocked(qid text) returns void
language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then return; end if;
  if exists (select 1 from public.quiz_attempts where quiz_id = qid) then
    raise exception 'quiz % already has attempts; its questions are locked', qid using errcode = '23514';
  end if;
end $$;

create function private.trg_lock_quiz_content() returns trigger
language plpgsql set search_path = '' as $$
declare r jsonb; qid text;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  qid := case tg_table_name
    when 'quiz_questions' then r ->> 'quiz_id'
    else private.question_quiz(r ->> 'question_id')
  end;
  if qid is not null then perform private.assert_quiz_unlocked(qid); end if;
  return null;
end $$;
create trigger trg_lock_questions after insert or update or delete on public.quiz_questions
  for each row execute function private.trg_lock_quiz_content();
create trigger trg_lock_options after insert or update or delete on public.quiz_options
  for each row execute function private.trg_lock_quiz_content();
create trigger trg_lock_keys after insert or update or delete on public.quiz_question_keys
  for each row execute function private.trg_lock_quiz_content();

-- ---------------------------------------------------------------- assignment edit rules
create function private.assignment_edit_rules() returns trigger
language plpgsql set search_path = '' as $$
declare top numeric;
begin
  if new.points < old.points then
    select max(score) into top from public.assignment_submissions where assignment_id = new.id;
    if top is not null and new.points < top then
      raise exception 'a student already scored %; points cannot be lower', top using errcode = '23514';
    end if;
  end if;
  if new.due_at is distinct from old.due_at then
    update public.assignment_submissions
       set status = case when submitted_at > new.due_at then 'late'::public.submission_status
                         else 'submitted'::public.submission_status end
     where assignment_id = new.id and status in ('submitted', 'late');
  end if;
  return null;
end $$;
create trigger trg_assignment_edit_rules after update of points, due_at on public.assignments
  for each row execute function private.assignment_edit_rules();
