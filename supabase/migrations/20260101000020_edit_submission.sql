-- 020: a turned-in assignment can be edited until it is graded or the deadline closes.
-- Replaces submit_assignment from 017: the "already turned in" refusal now only applies once graded.
create or replace function public.submit_assignment(p_assignment_id text, p_text text, p_file_id text,
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
    submitted_at    = excluded.submitted_at;
  return st;
end $$;
