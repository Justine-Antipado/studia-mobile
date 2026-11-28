-- 045 planner exam reminders: a daily job notifies each student the day before an exam they
-- added. Every other notification in this app fires from a row trigger (insert/update); an exam
-- reminder instead depends on the calendar date advancing with no write behind it, so it needs an
-- actual scheduled job rather than a trigger.

create extension if not exists pg_cron with schema extensions;

alter table public.planner_exams
  add column reminder_sent_at timestamptz;

-- Marks which exams it already reminded, so re-running the job the same day (or a missed run
-- catching up) never double-notifies a student.
create function private.send_exam_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare v_tomorrow date := (now() at time zone 'Asia/Manila')::date + 1;
begin
  insert into public.notifications (user_id, kind, title, body, link_params)
  select e.student_id, 'reminder', 'Exam tomorrow: ' || e.title,
         'Don''t forget to review before your exam.', jsonb_build_object('meta', 'Planner')
  from public.planner_exams e
  where e.exam_date = v_tomorrow and e.reminder_sent_at is null;

  update public.planner_exams
  set reminder_sent_at = now()
  where exam_date = v_tomorrow and reminder_sent_at is null;
end $$;

-- 00:30 UTC = 08:30 Asia/Manila, a reasonable morning time for a "tomorrow" reminder.
select cron.schedule('exam-reminders-daily', '30 0 * * *', $$select private.send_exam_reminders();$$);
