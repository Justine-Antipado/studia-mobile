-- 025 admin portal on the real database.
--
-- The admin site (studia-admin) used to run on an in-memory mock. Every page now reads and writes this
-- database with the admin's OWN Supabase session. Migration 008 deliberately removed the admin's direct
-- table access, so instead of re-opening RLS table by table, the admin gets a small set of
-- SECURITY DEFINER functions. Each one calls private.assert_admin() first: any other caller (student,
-- instructor, anon) gets 42501. Every write the admin makes is recorded in audit_log.
--
-- Also: admin inbox notifications (failed lesson processing, locked accounts, storage warnings) and the
-- push-delivery status the Announcements page shows.

-- ---------------------------------------------------------------- helpers
create or replace function private.assert_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
end $$;

create or replace function private.section_label(p_course text, p_year text, p_section text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(p_course, '') || ' ' || coalesce(p_year, '') || '-' || coalesce(p_section, '')
$$;

create or replace function private.audit(p_action public.audit_action, p_summary text, p_target text default null, p_ids jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select full_name into v_name from public.users where id = (select auth.uid());
  insert into public.audit_log (actor_id, actor_name, action, summary, target_type, target_ids)
  values ((select auth.uid()), coalesce(v_name, 'Administrator'), p_action, left(p_summary, 255), p_target, p_ids);
end $$;

-- every active admin, for the inbox triggers below
create or replace function private.notify_admins(p_kind public.notification_kind, p_title text, p_body text, p_dedupe_hours integer default 1)
returns void language plpgsql security definer set search_path = '' as $$
declare v_admins uuid[];
begin
  select coalesce(array_agg(u.id), '{}') into v_admins
  from public.users u
  where u.role = 'admin' and u.status = 'active' and u.deleted_at is null
    and not exists (select 1 from public.notifications n
                    where n.user_id = u.id and n.kind = p_kind and n.title = left(btrim(p_title), 140)
                      and n.read_at is null and n.created_at > now() - make_interval(hours => p_dedupe_hours));
  perform private.notify_users(v_admins, p_kind, p_title, 'Admin alert', p_body);
end $$;

create or replace function private.storage_quota_bytes() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce((select (data ->> 'storage_quota_mb')::bigint from public.settings where section = 'system'), 1024)
         * 1024 * 1024
$$;

-- ---------------------------------------------------------------- nav counts + notifications inbox
create or replace function public.admin_nav_counts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return jsonb_build_object('unreadNotifications', (
    select count(*) from public.notifications
    where user_id = (select auth.uid()) and read_at is null and kind in ('job', 'storage', 'security')));
end $$;

create or replace function public.admin_notifications() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id, 'type', n.kind, 'title', n.title, 'message', n.body,
      'read', n.read_at is not null, 'createdAt', n.created_at) order by n.created_at desc)
    from (select * from public.notifications
          where user_id = (select auth.uid()) and kind in ('job', 'storage', 'security')
          order by created_at desc limit 500) n), '[]'::jsonb);
end $$;

create or replace function public.admin_mark_notification_read(p_id text, p_read boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n public.notifications;
begin
  perform private.assert_admin();
  update public.notifications set read_at = case when p_read then coalesce(read_at, now()) else null end
  where id = p_id and user_id = (select auth.uid()) returning * into n;
  if not found then raise exception 'notification not found' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', n.id, 'type', n.kind, 'title', n.title, 'message', n.body,
                            'read', n.read_at is not null, 'createdAt', n.created_at);
end $$;

create or replace function public.admin_mark_all_notifications_read() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and read_at is null and kind in ('job', 'storage', 'security');
  return true;
end $$;

-- ---------------------------------------------------------------- dashboard
create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
  v_used bigint; v_quota bigint := private.storage_quota_bytes();
  v_ai_total int; v_ai_err int; v_stuck int;
  v_out jsonb;
begin
  perform private.assert_admin();
  select coalesce(sum(size_bytes), 0) into v_used from public.files;
  select count(*), count(*) filter (where status <> 'ok') into v_ai_total, v_ai_err
    from public.ai_requests where created_at > now() - interval '24 hours';
  select count(*) into v_stuck from public.materials
    where deleted_at is null and processing = 'processing' and posted_at < now() - interval '30 minutes';

  select jsonb_build_object(
    'stats', jsonb_build_object(
      'totalUsers',  (select count(*) from public.users where deleted_at is null and role in ('student', 'instructor')),
      'students',    (select count(*) from public.users where deleted_at is null and role = 'student'),
      'instructors', (select count(*) from public.users where deleted_at is null and role = 'instructor'),
      'activeToday', (select count(*) from public.users where deleted_at is null and role in ('student', 'instructor') and last_active_at >= v_today),
      'classes',     (select count(*) from public.classes where deleted_at is null),
      'aiRequests',  (select count(*) from public.ai_requests)),
    'registrations', (
      select jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon'),
        'count', (select count(*) from public.users u
                  where u.deleted_at is null and u.role in ('student', 'instructor')
                    and date_trunc('month', u.created_at) = m)) order by m)
      from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m),
    'roleDistribution', jsonb_build_array(
      jsonb_build_object('label', 'Students',    'value', (select count(*) from public.users where deleted_at is null and role = 'student')),
      jsonb_build_object('label', 'Instructors', 'value', (select count(*) from public.users where deleted_at is null and role = 'instructor'))),
    'courseDistribution', (
      select jsonb_agg(jsonb_build_object('label', c, 'value',
        (select count(*) from public.users u where u.deleted_at is null and u.role = 'student' and u.course::text = c)) order by c)
      from unnest(enum_range(null::public.course_code)::text[]) c),
    'aiUsage', jsonb_build_array(
      jsonb_build_object('feature', 'Summarizer',  'count', (select count(*) from public.ai_requests where feature = 'summarizer')),
      jsonb_build_object('feature', 'Planner',     'count', (select count(*) from public.ai_requests where feature = 'planner')),
      jsonb_build_object('feature', 'Quiz synth.', 'count', (select count(*) from public.ai_requests where feature = 'quiz_synthesizer')),
      jsonb_build_object('feature', 'Chat',        'count', (select count(*) from public.ai_requests where feature = 'chat'))),
    'systemHealth', jsonb_build_object(
      'storageUsedPct', least(100, round(v_used * 100.0 / nullif(v_quota, 0))),
      'storageUsedBytes', v_used, 'storageQuotaBytes', v_quota,
      'database', 'Online',
      'aiService', case when v_ai_total = 0 then 'No recent activity'
                        when v_ai_err * 2 > v_ai_total then 'Degraded' else 'Operational' end,
      'queue', case when v_stuck > 0 then 'Delayed' else 'Operational' end),
    'activity', (
      select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'type', a.type, 'message', a.message, 'at', a.at) order by a.at desc), '[]'::jsonb)
      from (
        select * from (
          select 'u-' || u.id as id, 'registration' as type,
                 u.full_name || ' registered as ' || case when u.role = 'instructor' then 'an Instructor.' else 'a Student.' end as message,
                 u.created_at as at
          from public.users u where u.deleted_at is null and u.role in ('student', 'instructor')
          union all
          select 'm-' || m.id, 'content',
                 coalesce(p.full_name, 'An instructor') || ' uploaded "' || m.title || '".', m.posted_at
          from public.materials m left join public.users p on p.id = m.owner_id where m.deleted_at is null
          union all
          select 'a-' || a.id, 'announcement',
                 coalesce(p.full_name, 'An instructor') || ' posted "' || a.title || '" in ' || c.title || '.', a.posted_at
          from public.announcements a join public.classes c on c.id = a.class_id
          left join public.users p on p.id = a.author_id where a.deleted_at is null
          union all
          select 'r-' || r.id, 'ai',
                 'AI ' || replace(r.feature::text, '_', ' ') || ' request ' || case r.status when 'ok' then 'completed.' when 'timeout' then 'timed out.' else 'failed.' end,
                 r.created_at
          from public.ai_requests r
          union all
          select 's-' || l.id, 'security', l.summary, l.logged_at
          from public.audit_log l where l.action = 'security'
        ) x order by at desc limit 8) a)
  ) into v_out;
  return v_out;
end $$;

-- ---------------------------------------------------------------- users
create or replace function public.admin_users() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', u.id, 'name', u.full_name, 'email', u.email, 'role', initcap(u.role::text),
      'course', u.course, 'year', u.year_level, 'section', u.section, 'department', u.department,
      'status', case when u.status = 'active' then 'Active' else 'Inactive' end,
      'joinedAt', u.created_at, 'lastActiveAt', coalesce(u.last_active_at, u.created_at)) order by u.full_name)
    from public.users u
    where u.deleted_at is null and u.role in ('student', 'instructor')), '[]'::jsonb);
end $$;

create or replace function public.admin_user(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u public.users;
begin
  perform private.assert_admin();
  select * into u from public.users where id = p_id and deleted_at is null and role in ('student', 'instructor');
  if not found then raise exception 'user not found' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'id', u.id, 'name', u.full_name, 'email', u.email, 'role', initcap(u.role::text),
    'course', u.course, 'year', u.year_level, 'section', u.section, 'department', u.department,
    'status', case when u.status = 'active' then 'Active' else 'Inactive' end,
    'joinedAt', u.created_at, 'lastActiveAt', coalesce(u.last_active_at, u.created_at),
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title,
               'section', private.section_label(c.course::text, c.year_level::text, c.section::text),
               'role', case when u.role = 'instructor' then 'Instructor' else 'Enrolled' end) order by c.title)
      from public.classes c
      where c.deleted_at is null
        and ((u.role = 'instructor' and c.instructor_id = u.id)
          or (u.role = 'student' and exists (select 1 from public.class_enrollments e
                                             where e.class_id = c.id and e.student_id = u.id and e.left_at is null)))), '[]'::jsonb),
    'activity', (
      select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'action', a.action, 'at', a.at) order by a.at desc), '[]'::jsonb)
      from (select * from (
        select 'created' as id, 'Account created.' as action, u.created_at as at
        union all select 'active', 'Last seen in the app.', u.last_active_at where u.last_active_at is not null
        union all select 's-' || s.id, 'Submitted an assignment.', s.submitted_at
          from public.assignment_submissions s where s.student_id = u.id and s.submitted_at is not null
        union all select 'q-' || q.id, 'Completed a quiz.', q.submitted_at
          from public.quiz_attempts q where q.student_id = u.id and q.submitted_at is not null
        union all select 'v-' || v.id, 'Opened a lesson.', v.last_seen_at
          from public.material_views v where v.student_id = u.id
        union all select 'm-' || m.id, 'Uploaded "' || m.title || '".', m.posted_at
          from public.materials m where m.owner_id = u.id and m.deleted_at is null
        union all select 'a-' || a.id, 'Posted "' || a.title || '" to a class.', a.posted_at
          from public.announcements a where a.author_id = u.id and a.deleted_at is null
        union all select 'r-' || r.id, 'Used the AI ' || replace(r.feature::text, '_', ' ') || '.', r.created_at
          from public.ai_requests r where r.user_id = u.id
      ) x order by at desc limit 8) a),
    'aiUsage', jsonb_build_object(
      'summarizer',      (select count(*) from public.ai_requests where user_id = u.id and feature = 'summarizer'),
      'planner',         (select count(*) from public.ai_requests where user_id = u.id and feature = 'planner'),
      'quizSynthesizer', (select count(*) from public.ai_requests where user_id = u.id and feature = 'quiz_synthesizer'),
      'chat',            (select count(*) from public.ai_requests where user_id = u.id and feature = 'chat')));
end $$;

-- Hard delete (auth.users cascades to public.users and the person's own rows). Classes.instructor_id is
-- RESTRICT, so an instructor's classes are removed first. The admin account itself can never be deleted.
create or replace function public.admin_delete_users(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[]; v_names text; v_n int;
begin
  perform private.assert_admin();
  select coalesce(array_agg(id), '{}'), string_agg(full_name, ', ') into v_ids, v_names
  from public.users where id = any(p_ids) and role in ('student', 'instructor');
  if coalesce(array_length(v_ids, 1), 0) = 0 then return jsonb_build_object('deleted', 0); end if;
  delete from public.classes where instructor_id = any(v_ids);
  delete from auth.users where id = any(v_ids);
  get diagnostics v_n = row_count;
  perform private.audit('delete', 'Deleted ' || v_n || ' user account' || case when v_n = 1 then '' else 's' end || ': ' || left(v_names, 160) || '.',
                        'user', to_jsonb(v_ids));
  return jsonb_build_object('deleted', v_n);
end $$;

-- ---------------------------------------------------------------- classes
create or replace function public.admin_classes() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'code', c.subject_code, 'title', c.title, 'instructorId', c.instructor_id,
      'instructorName', coalesce(i.full_name, 'Unknown'), 'course', c.course, 'year', c.year_level,
      'section', c.section, 'sectionLabel', private.section_label(c.course::text, c.year_level::text, c.section::text),
      'joinCode', c.join_code, 'archived', c.archived, 'createdAt', c.created_at,
      'studentCount', (select count(*) from public.class_enrollments e where e.class_id = c.id and e.left_at is null)
    ) order by c.title)
    from public.classes c left join public.users i on i.id = c.instructor_id
    where c.deleted_at is null), '[]'::jsonb);
end $$;

create or replace function public.admin_class(p_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.classes; v_mat int; v_asg int;
begin
  perform private.assert_admin();
  select * into c from public.classes where id = p_id and deleted_at is null;
  if not found then raise exception 'class not found' using errcode = 'P0002'; end if;
  select count(*) into v_mat from public.materials where class_id = c.id and deleted_at is null;
  select count(*) into v_asg from public.assignments where class_id = c.id and deleted_at is null;
  return jsonb_build_object(
    'id', c.id, 'code', c.subject_code, 'title', c.title, 'instructorId', c.instructor_id,
    'instructorName', coalesce((select full_name from public.users where id = c.instructor_id), 'Unknown'),
    'course', c.course, 'year', c.year_level, 'section', c.section,
    'sectionLabel', private.section_label(c.course::text, c.year_level::text, c.section::text),
    'joinCode', c.join_code, 'archived', c.archived, 'createdAt', c.created_at,
    'studentCount', (select count(*) from public.class_enrollments e where e.class_id = c.id and e.left_at is null),
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.full_name, 'email', s.email,
        'progress', case when v_mat = 0 then 0 else round((select count(*) from public.material_views mv
                          join public.materials m on m.id = mv.material_id
                          where mv.student_id = s.id and m.class_id = c.id and m.deleted_at is null and mv.completed_at is not null)::numeric / v_mat, 2) end,
        'submittedCount', (select count(*) from public.assignment_submissions sub
                           join public.assignments a on a.id = sub.assignment_id
                           where sub.student_id = s.id and a.class_id = c.id and a.deleted_at is null and sub.submitted_at is not null),
        'pendingCount', greatest(0, v_asg - (select count(*) from public.assignment_submissions sub
                           join public.assignments a on a.id = sub.assignment_id
                           where sub.student_id = s.id and a.class_id = c.id and a.deleted_at is null and sub.submitted_at is not null))
      ) order by s.full_name)
      from public.class_enrollments e join public.users s on s.id = e.student_id
      where e.class_id = c.id and e.left_at is null), '[]'::jsonb),
    'materials', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'kind', m.kind, 'processing', initcap(m.processing::text),
                                          'sizeBytes', coalesce(f.size_bytes, 0), 'postedAt', m.posted_at) order by m.posted_at desc)
      from public.materials m left join public.files f on f.id = m.file_id
      where m.class_id = c.id and m.deleted_at is null), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'dueAt', a.due_at, 'points', a.points,
                                          'allowLate', a.allow_late, 'createdAt', a.created_at) order by a.created_at desc)
      from public.assignments a where a.class_id = c.id and a.deleted_at is null), '[]'::jsonb),
    'announcements', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body, 'pinned', a.pinned, 'postedAt', a.posted_at)
                       order by a.posted_at desc)
      from public.announcements a where a.class_id = c.id and a.deleted_at is null), '[]'::jsonb));
end $$;

-- Soft delete, like the app's own delete_class: the class disappears everywhere and can be restored from the DB.
create or replace function public.admin_delete_classes(p_ids text[]) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_n int; v_titles text;
begin
  perform private.assert_admin();
  select string_agg(title, ', ') into v_titles from public.classes where id = any(p_ids) and deleted_at is null;
  update public.classes set deleted_at = now() where id = any(p_ids) and deleted_at is null;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform private.audit('delete', 'Deleted ' || v_n || ' class' || case when v_n = 1 then '' else 'es' end || ': ' || left(v_titles, 160) || '.', 'class', to_jsonb(p_ids));
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------- content
create or replace function public.admin_content() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'classId', m.class_id, 'className', c.title, 'title', m.title, 'kind', m.kind,
      'processing', initcap(m.processing::text), 'sizeBytes', coalesce(f.size_bytes, 0),
      'ownerId', m.owner_id, 'ownerName', coalesce(o.full_name, 'Unknown'), 'postedAt', m.posted_at) order by m.posted_at desc)
    from public.materials m
    join public.classes c on c.id = m.class_id and c.deleted_at is null
    left join public.files f on f.id = m.file_id
    left join public.users o on o.id = m.owner_id
    where m.deleted_at is null), '[]'::jsonb);
end $$;

create or replace function public.admin_delete_content(p_ids text[]) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  perform private.assert_admin();
  update public.materials set deleted_at = now() where id = any(p_ids) and deleted_at is null;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform private.audit('delete', 'Deleted ' || v_n || ' content item' || case when v_n = 1 then '' else 's' end || '.', 'material', to_jsonb(p_ids));
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------- assessments
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
           'dueAt', a.due_at, 'points', a.points, 'allowLate', a.allow_late, 'createdAt', a.created_at) order by a.created_at desc), '[]'::jsonb)
  into v_asg
  from public.assignments a join public.classes c on c.id = a.class_id and c.deleted_at is null
  where a.deleted_at is null;

  return jsonb_build_object('quizzes', v_quizzes, 'assignments', v_asg, 'stats', jsonb_build_object(
    'totalQuizzes', v_total,
    'aiGeneratedPct', case when v_total = 0 then 0 else round(100.0 * v_ai / v_total) end,
    'totalAssignments', jsonb_array_length(v_asg),
    'avgSubmissionRate', v_rate));
end $$;

-- ---------------------------------------------------------------- class announcements (moderation)
create or replace function public.admin_class_announcements() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'classId', a.class_id, 'className', c.title,
      'sectionLabel', private.section_label(c.course::text, c.year_level::text, c.section::text),
      'authorName', coalesce(p.full_name, 'Instructor'), 'title', a.title, 'body', a.body,
      'postedAt', a.posted_at, 'pinned', a.pinned,
      'commentCount', (select count(*) from public.announcement_comments k where k.announcement_id = a.id and k.deleted_at is null),
      'comments', coalesce((
        select jsonb_agg(jsonb_build_object('id', k.id, 'author', coalesce(ka.full_name, 'Former user'),
                 'authorIsInstructor', coalesce(ka.role = 'instructor', false), 'text', k.body, 'postedAt', k.posted_at) order by k.posted_at)
        from public.announcement_comments k left join public.users ka on ka.id = k.author_id
        where k.announcement_id = a.id and k.deleted_at is null), '[]'::jsonb)
    ) order by a.posted_at desc)
    from public.announcements a
    join public.classes c on c.id = a.class_id and c.deleted_at is null
    left join public.users p on p.id = a.author_id
    where a.deleted_at is null), '[]'::jsonb);
end $$;

create or replace function public.admin_delete_class_announcements(p_ids text[]) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  perform private.assert_admin();
  update public.announcements set deleted_at = now() where id = any(p_ids) and deleted_at is null;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    perform private.audit('delete', 'Deleted ' || v_n || ' class announcement' || case when v_n = 1 then '' else 's' end || '.', 'announcement', to_jsonb(p_ids));
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------- settings (maintenance, AI, legal, email)
create or replace function public.admin_get_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return coalesce((select jsonb_object_agg(section::text, data) from public.settings), '{}'::jsonb);
end $$;

-- Merge-saves whole top-level sections. Only the sections the admin portal edits are accepted; keys are
-- snake_case (the client converts), and unknown keys inside a section are kept (shallow merge).
create or replace function public.admin_save_settings(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; v jsonb; v_labels jsonb := '{"email":"the email settings","system":"the system settings","legal":"the legal text","ai":"the AI settings"}';
        v_changed text[] := '{}'; v_limit numeric;
begin
  perform private.assert_admin();
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'invalid settings' using errcode = '22023'; end if;
  for k, v in select * from jsonb_each(p_patch) loop
    if not (v_labels ? k) then raise exception 'unknown settings section: %', k using errcode = '22023'; end if;
    if jsonb_typeof(v) <> 'object' then raise exception 'invalid % settings', k using errcode = '22023'; end if;
    if k = 'legal' and (char_length(coalesce(v ->> 'terms', '')) > 20000 or char_length(coalesce(v ->> 'privacy', '')) > 20000) then
      raise exception 'legal text is too long' using errcode = '22023';
    end if;
    if k = 'ai' and v ? 'daily_request_limit' then
      v_limit := (v ->> 'daily_request_limit')::numeric;
      if v_limit is null or v_limit < 1 or v_limit > 1000000 or v_limit <> trunc(v_limit) then
        raise exception 'daily request limit must be a whole number between 1 and 1,000,000' using errcode = '22023';
      end if;
    end if;
    if k = 'system' and char_length(coalesce(v #>> '{maintenance,message}', '')) > 500 then
      raise exception 'maintenance message is too long' using errcode = '22023';
    end if;
    insert into public.settings (section, data, updated_by) values (k::public.settings_section, v, (select auth.uid()))
    on conflict (section) do update set data = public.settings.data || excluded.data, updated_by = excluded.updated_by, updated_at = now();
    v_changed := v_changed || (v_labels ->> k);
  end loop;
  if array_length(v_changed, 1) > 0 then
    perform private.audit('settings', 'Updated ' || array_to_string(v_changed, ', ') || '.', 'settings');
  end if;
  return coalesce((select jsonb_object_agg(section::text, data) from public.settings), '{}'::jsonb);
end $$;

create or replace function public.admin_update_ai_feature(p_feature text, p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_key text; v_data jsonb;
begin
  perform private.assert_admin();
  v_key := case p_feature when 'summarizer' then 'summarizer' when 'planner' then 'planner'
                          when 'quizSynthesizer' then 'quiz_synthesizer' when 'chat' then 'chat' end;
  if v_key is null then raise exception 'unknown AI feature' using errcode = 'P0002'; end if;
  insert into public.settings (section, data, updated_by)
  values ('ai', jsonb_build_object(v_key, p_enabled), (select auth.uid()))
  on conflict (section) do update set data = public.settings.data || excluded.data, updated_by = excluded.updated_by, updated_at = now()
  returning data into v_data;
  perform private.audit('update', (case when p_enabled then 'Enabled' else 'Disabled' end) || ' the AI ' || replace(v_key, '_', ' ') || ' feature.', 'settings');
  return v_data;
end $$;

-- ---------------------------------------------------------------- AI health
create or replace function public.admin_ai_health() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_ai jsonb; v_limit int; v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
begin
  perform private.assert_admin();
  select coalesce(data, '{}'::jsonb) into v_ai from public.settings where section = 'ai';
  v_ai := coalesce(v_ai, '{}'::jsonb);
  v_limit := coalesce((v_ai ->> 'daily_request_limit')::int, 5000);
  return jsonb_build_object(
    'requestsTrend', (
      select jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon'),
        'count', (select count(*) from public.ai_requests r where date_trunc('month', r.created_at) = m)) order by m)
      from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m),
    'usageByFeature', jsonb_build_array(
      jsonb_build_object('feature', 'Summarizer',    'count', (select count(*) from public.ai_requests where feature = 'summarizer')),
      jsonb_build_object('feature', 'Planner',       'count', (select count(*) from public.ai_requests where feature = 'planner')),
      jsonb_build_object('feature', 'Quiz synth.',   'count', (select count(*) from public.ai_requests where feature = 'quiz_synthesizer')),
      jsonb_build_object('feature', 'Chat',          'count', (select count(*) from public.ai_requests where feature = 'chat')),
      jsonb_build_object('feature', 'Transcription', 'count', (select count(*) from public.ai_requests where feature = 'transcription'))),
    'featureHealth', (
      select jsonb_agg(jsonb_build_object('feature', f.key, 'label', f.label,
        'avgLatencyMs', coalesce(round((select avg(latency_ms) from public.ai_requests r where r.feature::text = f.col and r.latency_ms is not null)), 0),
        'errorRatePct', coalesce(round((select 100.0 * count(*) filter (where r.status <> 'ok') / nullif(count(*), 0)
                                        from public.ai_requests r where r.feature::text = f.col), 1), 0)) order by f.ord)
      from (values (1, 'summarizer', 'summarizer', 'Summarizer'), (2, 'planner', 'planner', 'Study planner'),
                   (3, 'quizSynthesizer', 'quiz_synthesizer', 'Quiz synthesizer'), (4, 'chat', 'chat', 'AI chat')) f(ord, key, col, label)),
    'quota', jsonb_build_object(
      'requestsUsed', (select count(*) from public.ai_requests where created_at >= v_today),
      'requestsQuota', v_limit,
      'costEstimateUsd', coalesce((select sum(cost_usd) from public.ai_requests where created_at >= date_trunc('month', now())), 0),
      'resetsOn', ((v_today + interval '1 day') at time zone 'Asia/Manila')::date),
    'toggles', jsonb_build_object(
      'summarizer',      coalesce((v_ai ->> 'summarizer')::boolean, true),
      'planner',         coalesce((v_ai ->> 'planner')::boolean, true),
      'quizSynthesizer', coalesce((v_ai ->> 'quiz_synthesizer')::boolean, true),
      'chat',            coalesce((v_ai ->> 'chat')::boolean, true)),
    'transcription', jsonb_build_object(
      'queued', (select count(*) from public.materials where deleted_at is null and kind = 'video' and processing = 'processing'),
      'avgProcessingSec', coalesce((select round(avg(latency_ms) / 1000.0) from public.ai_requests where feature = 'transcription' and status = 'ok'), 0),
      'failures', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'className', c.title,
                 'ownerName', coalesce(o.full_name, 'Unknown'), 'postedAt', m.posted_at) order by m.posted_at desc)
        from public.materials m join public.classes c on c.id = m.class_id and c.deleted_at is null
        left join public.users o on o.id = m.owner_id
        where m.deleted_at is null and m.kind = 'video' and m.processing = 'failed'), '[]'::jsonb)),
    'quizGeneration', jsonb_build_object(
      'byBloom', (select jsonb_agg(jsonb_build_object('label', b, 'value',
          (select count(*) from public.quiz_questions q join public.quizzes z on z.id = q.quiz_id
           where z.source = 'ai' and z.deleted_at is null and q.bloom::text = b)) order by o)
        from unnest(enum_range(null::public.bloom_level)::text[]) with ordinality t(b, o)),
      'byDifficulty', (select jsonb_agg(jsonb_build_object('label', d, 'value',
          (select count(*) from public.quiz_questions q join public.quizzes z on z.id = q.quiz_id
           where z.source = 'ai' and z.deleted_at is null and q.difficulty::text = d)) order by o)
        from unnest(enum_range(null::public.difficulty_level)::text[]) with ordinality t(d, o))));
end $$;

-- ---------------------------------------------------------------- reports
create or replace function public.admin_reports() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_since timestamptz := now() - interval '30 days';
begin
  perform private.assert_admin();
  return (
    with activity as (   -- one row per (student, moment of real activity)
      select student_id as uid, last_seen_at as at from public.material_views
      union all select student_id, started_at from public.quiz_attempts
      union all select student_id, created_at from public.assignment_submissions
      union all select user_id, created_at from public.ai_requests where user_id is not null
    )
    select jsonb_build_object(
      'userGrowth', (
        select jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon'),
          'students',    (select count(*) from public.users u where u.deleted_at is null and u.role = 'student'    and date_trunc('month', u.created_at) = m),
          'instructors', (select count(*) from public.users u where u.deleted_at is null and u.role = 'instructor' and date_trunc('month', u.created_at) = m)) order by m)
        from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m),
      'engagementTrend', (
        select jsonb_agg(jsonb_build_object('week', 'Wk ' || (5 - w),
          'activeUsers', (select count(distinct a.uid) from activity a
                          where a.at >= now() - make_interval(days => 7 * w) and a.at < now() - make_interval(days => 7 * (w - 1)))) order by w desc)
        from generate_series(4, 1, -1) w),
      'participationByCourse', (
        select jsonb_agg(jsonb_build_object('label', c, 'value',
          coalesce(round(100.0 * (select count(*) from public.users u where u.deleted_at is null and u.role = 'student' and u.course::text = c
                                    and exists (select 1 from activity a where a.uid = u.id and a.at >= v_since))
                         / nullif((select count(*) from public.users u where u.deleted_at is null and u.role = 'student' and u.course::text = c), 0)), 0)) order by c)
        from unnest(enum_range(null::public.course_code)::text[]) c),
      'contentConsumption', (
        select jsonb_agg(jsonb_build_object('label', k.label,
          'views', coalesce((select sum(v.view_count) from public.material_views v join public.materials m on m.id = v.material_id
                             where m.kind::text = k.kind and m.deleted_at is null), 0),
          'completionPct', coalesce((select round(100.0 * count(*) filter (where v.completed_at is not null) / nullif(count(*), 0))
                             from public.material_views v join public.materials m on m.id = v.material_id
                             where m.kind::text = k.kind and m.deleted_at is null), 0)) order by k.ord)
        from (values (1, 'video', 'Video'), (2, 'pdf', 'PDF'), (3, 'slide', 'Slides')) k(ord, kind, label)),
      'strugglingConcepts', coalesce((
        select jsonb_agg(jsonb_build_object('id', s.id, 'concept', s.concept, 'course', s.course,
                 'avgScorePct', s.avg_pct, 'studentsAffected', s.affected) order by s.avg_pct, s.concept)
        from (
          select md5(q.concept || coalesce(c.course::text, '')) as id, q.concept, c.course::text as course,
                 round(100.0 * sum(coalesce(a.awarded_points, 0)) / nullif(sum(q.points), 0)) as avg_pct,
                 count(distinct t.student_id) filter (where coalesce(a.awarded_points, 0) < q.points) as affected
          from public.quiz_answers a
          join public.quiz_attempts t on t.id = a.attempt_id and t.submitted_at is not null
          join public.quiz_questions q on q.id = a.question_id and q.concept is not null
          join public.quizzes z on z.id = q.quiz_id and z.deleted_at is null
          join public.classes c on c.id = z.class_id and c.deleted_at is null
          group by q.concept, c.course
          having round(100.0 * sum(coalesce(a.awarded_points, 0)) / nullif(sum(q.points), 0)) < 70
          order by 4, 2 limit 20) s), '[]'::jsonb)
    ));
end $$;

-- ---------------------------------------------------------------- security
create or replace function public.admin_audit_log() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'actor', coalesce(l.actor_name, 'System'), 'action', l.action,
                                        'summary', l.summary, 'at', l.logged_at) order by l.logged_at desc)
    from (select * from public.audit_log order by logged_at desc limit 2000) l), '[]'::jsonb);
end $$;

create or replace function public.admin_login_attempts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'identifier', l.identifier, 'success', l.success, 'locked', l.locked,
                                        'ip', coalesce(host(l.ip), '—'), 'at', l.attempted_at) order by l.attempted_at desc)
    from (select * from public.login_attempts order by attempted_at desc limit 2000) l), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- push delivery status (Announcements page)
create or replace function public.admin_push_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return jsonb_build_object(
    'devices', (select count(*) from public.push_tokens),
    'users',   (select count(distinct user_id) from public.push_tokens),
    'configured', exists (select 1 from vault.decrypted_secrets where name = 'push_function_url')
                  and exists (select 1 from vault.decrypted_secrets where name = 'push_webhook_secret'));
end $$;

-- ---------------------------------------------------------------- grants
do $$
declare f text;
begin
  for f in select unnest(array[
    'admin_nav_counts()', 'admin_notifications()', 'admin_mark_notification_read(text, boolean)',
    'admin_mark_all_notifications_read()', 'admin_dashboard()', 'admin_users()', 'admin_user(uuid)',
    'admin_delete_users(uuid[])', 'admin_classes()', 'admin_class(text)', 'admin_delete_classes(text[])',
    'admin_content()', 'admin_delete_content(text[])', 'admin_assessments()', 'admin_class_announcements()',
    'admin_delete_class_announcements(text[])', 'admin_get_settings()', 'admin_save_settings(jsonb)',
    'admin_update_ai_feature(text, boolean)', 'admin_ai_health()', 'admin_reports()', 'admin_audit_log()',
    'admin_login_attempts()', 'admin_push_status()']) loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function private.assert_admin(), private.audit(public.audit_action, text, text, jsonb),
  private.notify_admins(public.notification_kind, text, text, integer), private.storage_quota_bytes() from public, anon;
grant execute on function private.assert_admin(), private.audit(public.audit_action, text, text, jsonb),
  private.section_label(text, text, text), private.notify_admins(public.notification_kind, text, text, integer),
  private.storage_quota_bytes() to authenticated, service_role;

-- ---------------------------------------------------------------- admin inbox: who creates the rows
-- A lesson that failed processing.
create or replace function private.trg_admin_material_failed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.processing = 'failed' and (tg_op = 'INSERT' or old.processing is distinct from 'failed') then
    perform private.notify_admins('job', 'Lesson processing failed',
      '"' || new.title || '" could not be processed' || coalesce(': ' || nullif(left(new.processing_error, 200), ''), '.'), 1);
  end if;
  return null;
end $$;
create trigger trg_admin_material_failed after insert or update of processing on public.materials
  for each row execute function private.trg_admin_material_failed();

-- An AI request that errored or timed out (one alert per feature per hour, not one per request).
create or replace function private.trg_admin_ai_failed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'ok' then
    perform private.notify_admins('job', 'AI ' || replace(new.feature::text, '_', ' ') || ' requests are failing',
      'A request ' || case new.status when 'timeout' then 'timed out' else 'failed' end
        || coalesce(' (' || nullif(new.error_code, '') || ')', '') || '. Check AI health.', 1);
  end if;
  return null;
end $$;
create trigger trg_admin_ai_failed after insert on public.ai_requests
  for each row execute function private.trg_admin_ai_failed();

-- An account that was locked by repeated failed sign-ins.
create or replace function private.trg_admin_login_locked() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.locked then
    perform private.notify_admins('security', 'Account locked after failed sign-ins',
      'Sign-ins for "' || left(new.identifier, 120) || '" were locked' || coalesce(' (IP ' || host(new.ip) || ')', '') || '.', 1);
  end if;
  return null;
end $$;
create trigger trg_admin_login_locked after insert on public.login_attempts
  for each row execute function private.trg_admin_login_locked();

-- Storage over 80 % of the quota (settings.system.storage_quota_mb, default 1024 MB).
create or replace function private.trg_admin_storage() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_used bigint; v_quota bigint := private.storage_quota_bytes(); v_pct int;
begin
  select coalesce(sum(size_bytes), 0) into v_used from public.files;
  v_pct := round(v_used * 100.0 / nullif(v_quota, 0));
  if v_pct >= 80 then
    perform private.notify_admins('storage', 'Storage almost full',
      'Uploaded files use ' || v_pct || '% of the storage quota. Remove old content or raise the quota.', 24);
  end if;
  return null;
end $$;
create trigger trg_admin_storage after insert on public.files
  for each statement execute function private.trg_admin_storage();
