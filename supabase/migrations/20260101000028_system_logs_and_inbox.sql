-- 028 real system logs, a populated admin inbox, quiz late policy in the admin, full legal text.
--
--  1. audit_log was only written by admin actions. Database triggers now record what people do in the
--     apps (registrations, classes, lessons, quizzes, assignments, announcements, joins), and the
--     existing rows are backfilled with their real timestamps. Nothing here is sample data.
--  2. The admin inbox (Notifications page) is fed by the same `notifications` table as the mobile Alerts
--     tab: new registrations, campus announcements, failures. Existing history is backfilled.
--  3. admin_assessments returns each quiz's late policy and how many attempts were late.
--  4. The Terms of use and Privacy policy the mobile app shows live in settings.legal. Replace the
--     one-line placeholder with the full text (only when the admin has not written their own yet).

-- ---------------------------------------------------------------- 1. audit log from the apps
create or replace function private.log_event(
  p_actor uuid, p_action public.audit_action, p_summary text, p_type text, p_ids jsonb, p_at timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor_id, actor_name, action, summary, target_type, target_ids, logged_at)
  values (p_actor,
          coalesce((select full_name from public.users where id = p_actor), 'System'),
          p_action, left(p_summary, 255), p_type, p_ids, p_at);
end $$;

create or replace function private.trg_log_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role in ('student', 'instructor') then
    perform private.log_event(new.id, 'create', new.full_name || ' registered as ' ||
      case when new.role = 'instructor' then 'an instructor.' else 'a student.' end, 'user', jsonb_build_array(new.id), new.created_at);
  end if;
  return null;
exception when others then
  return null;  -- a log line must never block sign-up or a class action
end $$;
create trigger trg_log_user after insert on public.users for each row execute function private.trg_log_user();

create or replace function private.trg_log_class() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_event(new.instructor_id, 'create', 'Created the class "' || new.title || '".', 'class', jsonb_build_array(new.id), new.created_at);
  elsif new.deleted_at is not null and old.deleted_at is null and not private.is_admin() then
    perform private.log_event(new.instructor_id, 'delete', 'Deleted the class "' || new.title || '".', 'class', jsonb_build_array(new.id));
  end if;
  return null;
exception when others then
  return null;  -- a log line must never block sign-up or a class action
end $$;
create trigger trg_log_class after insert or update of deleted_at on public.classes for each row execute function private.trg_log_class();

create or replace function private.trg_log_material() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_event(new.owner_id, 'create', 'Uploaded the lesson "' || new.title || '".', 'material', jsonb_build_array(new.id), new.posted_at);
  elsif new.deleted_at is not null and old.deleted_at is null and not private.is_admin() then
    perform private.log_event(new.owner_id, 'delete', 'Deleted the lesson "' || new.title || '".', 'material', jsonb_build_array(new.id));
  end if;
  return null;
exception when others then
  return null;  -- a log line must never block sign-up or a class action
end $$;
create trigger trg_log_material after insert or update of deleted_at on public.materials for each row execute function private.trg_log_material();

create or replace function private.trg_log_quiz() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform private.log_event(new.created_by, 'create', 'Published the quiz "' || new.title || '".', 'quiz', jsonb_build_array(new.id),
                              coalesce(new.published_at, new.created_at));
  end if;
  return null;
exception when others then
  return null;  -- a log line must never block sign-up or a class action
end $$;
create trigger trg_log_quiz after insert or update of status on public.quizzes for each row execute function private.trg_log_quiz();

create or replace function private.trg_log_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.log_event(new.created_by, 'create', 'Posted the assignment "' || new.title || '".', 'assignment', jsonb_build_array(new.id), new.created_at);
  return null;
exception when others then
  return null;  -- a log line must never block sign-up or a class action
end $$;
create trigger trg_log_assignment after insert on public.assignments for each row execute function private.trg_log_assignment();

create or replace function private.trg_log_announcement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_event(new.author_id, 'create', 'Posted the class announcement "' || new.title || '".', 'announcement', jsonb_build_array(new.id), new.posted_at);
  elsif new.deleted_at is not null and old.deleted_at is null and not private.is_admin() then
    perform private.log_event(new.author_id, 'delete', 'Deleted the class announcement "' || new.title || '".', 'announcement', jsonb_build_array(new.id));
  end if;
  return null;
exception when others then
  return null;  -- a log line must never block sign-up or a class action
end $$;
create trigger trg_log_announcement after insert or update of deleted_at on public.announcements for each row execute function private.trg_log_announcement();

create or replace function private.trg_log_enroll() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.log_event(new.student_id, 'create',
    'Joined the class "' || coalesce((select title from public.classes where id = new.class_id), 'a class') || '".', 'class', jsonb_build_array(new.class_id), new.joined_at);
  return null;
exception when others then
  return null;  -- a log line must never block sign-up or a class action
end $$;
create trigger trg_log_enroll after insert on public.class_enrollments for each row execute function private.trg_log_enroll();

-- backfill what already happened (real rows, real timestamps), once
insert into public.audit_log (actor_id, actor_name, action, summary, target_type, target_ids, logged_at)
select x.* from (
select u.id, u.full_name, 'create'::public.audit_action, u.full_name || ' registered as ' || case when u.role = 'instructor' then 'an instructor.' else 'a student.' end,
       'user', jsonb_build_array(u.id), u.created_at
from public.users u where u.role in ('student', 'instructor')
union all
select c.instructor_id, coalesce(i.full_name, 'System'), 'create'::public.audit_action, 'Created the class "' || c.title || '".', 'class', jsonb_build_array(c.id), c.created_at
from public.classes c left join public.users i on i.id = c.instructor_id
union all
select m.owner_id, coalesce(o.full_name, 'System'), 'create'::public.audit_action, 'Uploaded the lesson "' || m.title || '".', 'material', jsonb_build_array(m.id), m.posted_at
from public.materials m left join public.users o on o.id = m.owner_id where m.deleted_at is null
union all
select q.created_by, coalesce(o.full_name, 'System'), 'create'::public.audit_action, 'Published the quiz "' || q.title || '".', 'quiz', jsonb_build_array(q.id), coalesce(q.published_at, q.created_at)
from public.quizzes q left join public.users o on o.id = q.created_by where q.deleted_at is null and q.status = 'published'
union all
select a.created_by, coalesce(o.full_name, 'System'), 'create'::public.audit_action, 'Posted the assignment "' || a.title || '".', 'assignment', jsonb_build_array(a.id), a.created_at
from public.assignments a left join public.users o on o.id = a.created_by where a.deleted_at is null
union all
select a.author_id, coalesce(o.full_name, 'System'), 'create'::public.audit_action, 'Posted the class announcement "' || a.title || '".', 'announcement', jsonb_build_array(a.id), a.posted_at
from public.announcements a left join public.users o on o.id = a.author_id where a.deleted_at is null
union all
select e.student_id, coalesce(s.full_name, 'System'), 'create'::public.audit_action, 'Joined the class "' || coalesce(c.title, 'a class') || '".', 'class', jsonb_build_array(e.class_id), e.joined_at
from public.class_enrollments e left join public.users s on s.id = e.student_id left join public.classes c on c.id = e.class_id
) x;

-- ---------------------------------------------------------------- 2. admin inbox from the same alerts
-- Not just failures any more: registrations and campus announcements land in the inbox too.
create or replace function public.admin_notifications() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id, 'type', n.kind, 'title', n.title, 'message', n.body,
      'read', n.read_at is not null, 'createdAt', n.created_at) order by n.created_at desc)
    from (select * from public.notifications where user_id = (select auth.uid()) order by created_at desc limit 500) n), '[]'::jsonb);
end $$;

create or replace function public.admin_nav_counts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return jsonb_build_object('unreadNotifications', (
    select count(*) from public.notifications where user_id = (select auth.uid()) and read_at is null));
end $$;

create or replace function public.admin_mark_all_notifications_read() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  update public.notifications set read_at = now() where user_id = (select auth.uid()) and read_at is null;
  return true;
end $$;

-- new accounts
create or replace function private.trg_admin_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role in ('student', 'instructor') then
    perform private.notify_admins('class', 'New ' || new.role::text || ' registered',
      new.full_name || ' (' || new.email || ') created an account.', 0);
  end if;
  return null;
exception when others then
  return null;  -- a log line must never block sign-up or a class action
end $$;
create trigger trg_admin_new_user after insert on public.users for each row execute function private.trg_admin_new_user();

-- campus announcement sent
create or replace function private.trg_admin_campus_sent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- recipients is filled in by trg_platform_announcement (an AFTER INSERT on the same row), so read it back
  perform private.notify_admins('notice', 'Campus announcement sent', '"' || new.title || '" was sent to ' || case new.audience::text when 'all' then 'everyone' when 'students' then 'all students' when 'instructors' then 'all instructors' else 'one course' end || '.', 0);
  return null;
exception when others then
  return null;  -- a log line must never block sign-up or a class action
end $$;
create trigger trg_admin_campus_sent after insert on public.platform_announcements
  for each row execute function private.trg_admin_campus_sent();

-- backfill the inbox from history. The push/email trigger is paused so nothing is re-sent.
alter table public.notifications disable trigger trg_push_notification;

do $$
declare v_admins uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_admins from public.users where role = 'admin' and status = 'active' and deleted_at is null;

  insert into public.notifications (user_id, kind, title, body, link_params, created_at, read_at)
  select a, x.kind::public.notification_kind, x.title, x.body, jsonb_build_object('meta', 'Admin alert'), x.at,
         case when x.at < now() - interval '7 days' then x.at end
  from unnest(v_admins) a,
  lateral (
    select 'class' as kind, 'New ' || u.role::text || ' registered' as title, u.full_name || ' (' || u.email || ') created an account.' as body, u.created_at as at
      from public.users u where u.role in ('student', 'instructor')
    union all
    select 'job', 'AI ' || replace(r.feature::text, '_', ' ') || ' requests are failing',
           'A request ' || case r.status when 'timeout' then 'timed out' else 'failed' end || coalesce(' (' || nullif(r.error_code, '') || ')', '') || '. Check AI health.', r.created_at
      from (select distinct on (feature, date_trunc('hour', created_at)) * from public.ai_requests where status <> 'ok' order by feature, date_trunc('hour', created_at), created_at) r
    union all
    select 'job', 'Lesson processing failed', '"' || m.title || '" could not be processed' || coalesce(': ' || nullif(left(m.processing_error, 200), ''), '.'), m.posted_at
      from public.materials m where m.deleted_at is null and m.processing = 'failed'
    union all
    select 'security', 'Account locked after failed sign-ins', 'Sign-ins for "' || left(l.identifier, 120) || '" were locked' || coalesce(' (IP ' || host(l.ip) || ')', '') || '.', l.attempted_at
      from public.login_attempts l where l.locked
    union all
    select 'notice', 'Campus announcement sent', '"' || p.title || '" was sent to ' || case p.audience::text when 'all' then 'everyone' when 'students' then 'all students' when 'instructors' then 'all instructors' else 'one course' end || '.', p.created_at
      from public.platform_announcements p
  ) x;
end $$;

alter table public.notifications enable trigger trg_push_notification;

-- ---------------------------------------------------------------- 3. quiz late policy in the admin
create or replace function public.admin_assessments() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_quizzes jsonb; v_asg jsonb; v_ai int; v_total int; v_rate numeric;
begin
  perform private.assert_admin();
  select coalesce(jsonb_agg(q.j order by q.created_at desc), '[]'::jsonb), count(*), count(*) filter (where q.is_ai), coalesce(round(avg(q.rate)), 0)
  into v_quizzes, v_total, v_ai, v_rate
  from (
    select z.created_at, z.source = 'ai' as is_ai, r.rate, jsonb_build_object(
      'id', z.id, 'classId', z.class_id, 'className', c.title, 'title', z.title,
      'source', case when z.source = 'ai' then 'AI' else 'Manual' end, 'status', initcap(z.status::text),
      'questionCount', (select count(*) from public.quiz_questions qq where qq.quiz_id = z.id),
      'bloom', (select qq.bloom::text from public.quiz_questions qq where qq.quiz_id = z.id and qq.bloom is not null
                group by qq.bloom order by count(*) desc, qq.bloom limit 1),
      'difficulty', (select qq.difficulty::text from public.quiz_questions qq where qq.quiz_id = z.id and qq.difficulty is not null
                     group by qq.difficulty order by count(*) desc, qq.difficulty limit 1),
      'dueAt', z.due_at, 'allowLate', z.allow_late, 'closesAt', z.closes_at,
      'lateAttempts', (select count(*) from public.quiz_attempts a where a.quiz_id = z.id and a.late),
      'submissionRatePct', r.rate, 'createdAt', z.created_at) as j
    from public.quizzes z
    join public.classes c on c.id = z.class_id and c.deleted_at is null
    cross join lateral (
      select case when e.n = 0 then 0 else round(100.0 * s.n / e.n) end as rate
      from (select count(*) n from public.class_enrollments en where en.class_id = z.class_id and en.left_at is null) e,
           (select count(distinct a.student_id) n from public.quiz_attempts a where a.quiz_id = z.id and a.submitted_at is not null) s
    ) r
    where z.deleted_at is null) q;

  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'classId', a.class_id, 'className', c.title, 'title', a.title,
           'dueAt', a.due_at, 'closesAt', a.closes_at, 'points', a.points, 'allowLate', a.allow_late,
           'lateSubmissions', (select count(*) from public.assignment_submissions s where s.assignment_id = a.id and s.status = 'late'),
           'createdAt', a.created_at) order by a.created_at desc), '[]'::jsonb)
  into v_asg
  from public.assignments a join public.classes c on c.id = a.class_id and c.deleted_at is null
  where a.deleted_at is null;

  return jsonb_build_object('quizzes', v_quizzes, 'assignments', v_asg, 'stats', jsonb_build_object(
    'totalQuizzes', v_total,
    'aiGeneratedPct', case when v_total = 0 then 0 else round(100.0 * v_ai / v_total) end,
    'totalAssignments', jsonb_array_length(v_asg),
    'avgSubmissionRate', v_rate));
end $$;

-- ---------------------------------------------------------------- 4. full Terms + Privacy in the database
update public.settings set data = jsonb_build_object(
  'terms', E'1. Using STUDIA\nSTUDIA Mobile is provided by Occidental Mindoro State University – Mamburao Campus for learning and academic activities. Use your own account, keep your login private, and do not upload content you do not have the right to share.\n\n2. Information we collect\nWe collect your name, school email, role, course enrollments, submissions, quiz results, and app activity so the app can work and your instructors can follow your progress.\n\n3. AI features\nLecture videos, documents, and text you upload may be processed by AI services to create transcripts, summaries, study plans, and quizzes. AI output can contain mistakes, so double-check important details.\n\n4. How your data is used\nYour data is used only for academic and app-improvement purposes. We do not sell your personal information. Access is limited to authorized school personnel and the services needed to run the app.\n\n5. Your rights\nUnder the Data Privacy Act of 2012 (RA 10173), you may ask to access, correct, or request deletion of your personal data. Contact the campus data protection officer for any request.\n\n6. Changes\nWe may update these terms and the privacy policy. We will notify you in the app when something important changes.',
  'privacy', E'What we collect\nYour name, school email, course/section (students) or department (instructors), and the work you submit in your classes: assignments, quiz answers and grades.\n\nHow it is used\nTo run your classes, show your instructor your submissions, and compute grades. AI features process the text you give them; do not paste passwords or sensitive personal data.\n\nWho can see it\nOnly you and the instructor of the class you belong to. Studia does not sell your data or show it to advertisers.\n\nYour choices\nYou can edit your profile and change your password from the Account tab. To delete your account, contact the OMSU Mamburao Campus administrator.'),
  updated_at = now()
where section = 'legal' and char_length(coalesce(data ->> 'terms', '')) < 200;
