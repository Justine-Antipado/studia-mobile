-- 030 instructor approval: a new instructor account does not work until an admin approves it.
--
-- WHY. private.handle_new_user() (009) takes `role` from auth.users.raw_user_meta_data, which is
-- whatever the client passed to auth.signUp as options.data. The Supabase anon key is public by
-- design -- it ships inside the app and is listed in studia-mobile/eas.json -- so anyone could POST
-- straight to /auth/v1/signup with {"role":"instructor"} and receive an ACTIVE instructor account,
-- never touching studia-api or its validation. `admin` was already ungrantable that way; `instructor`
-- was not. An instructor can create classes, publish materials, grade work, and read the roster of
-- their own students.
--
-- THE FIX. Keep honouring the requested role, but withhold `status`: a password sign-up that asks for
-- instructor is inserted as 'pending_approval'. Every door already refuses that status --
-- assertAccountUsable() in studia-api/src/lib/auth-core.ts throws ACCOUNT_PENDING, and the app shows
-- "Your instructor account is waiting for administrator approval" (remote-auth-service.ts:213,
-- auth-screen.tsx:319). Students are unaffected and stay 'active'.
--
-- Google sign-ups cannot use this door: they arrive with no role in their metadata (so they land as
-- 'student', profile_completed = false) and cannot write `role` themselves, because migration 001
-- revokes that column from `authenticated`. Their role is set once, server-side, by studia-api's
-- complete-profile endpoint -- which applies the same rule through REQUIRE_INSTRUCTOR_APPROVAL.
--
-- APPROVING. public.admin_set_user_active(ids, true) (026) already moves any status to 'active' and
-- clears auth.users.banned_until, so the portal's existing reactivate path IS the approve path; no new
-- RPC is needed. What was missing is visibility: admin_users() and admin_user() folded
-- 'pending_approval' into 'Inactive', so an admin could not tell a new instructor waiting for approval
-- from an account they had switched off. Both now report 'Pending'.
--
-- EXISTING DATA. Nothing is migrated. The trigger only runs for new auth.users rows, so every current
-- account keeps the status it has.

-- ---------------------------------------------------------------- the gate
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_google boolean := coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google';
  v_role   public.user_role := case meta ->> 'role'
             when 'instructor' then 'instructor'::public.user_role
             else 'student'::public.user_role end;  -- admin is never grantable via metadata
begin
  insert into public.users (id, role, full_name, email, auth_provider, profile_completed, status,
                            course, year_level, section, department, phone)
  values (
    new.id,
    v_role,
    left(coalesce(nullif(btrim(coalesce(meta ->> 'full_name', meta ->> 'name')), ''),
                  split_part(new.email, '@', 1)), 80),
    lower(btrim(new.email)),
    case when v_google then 'google'::public.auth_provider else 'password'::public.auth_provider end,
    not v_google,
    -- The client asked to be an instructor. Metadata is not evidence, so an admin confirms it before
    -- the account can be used. Google sign-ups have no role yet; complete-profile decides theirs.
    case when v_role = 'instructor' and not v_google
         then 'pending_approval'::public.account_status
         else 'active'::public.account_status end,
    case when v_role = 'student' and meta ->> 'course' in ('BSIT', 'BEED', 'BSBA-FM', 'BSBA-OM')
         then (meta ->> 'course')::public.course_code end,
    case when v_role = 'student' and meta ->> 'year' in ('1', '2', '3', '4')
         then (meta ->> 'year')::public.year_level end,
    case when v_role = 'student' and meta ->> 'section' in ('A', 'B', 'C', 'D', 'E')
         then (meta ->> 'section')::public.section_code end,
    case when v_role = 'instructor' and meta ->> 'department' in ('FM', 'OM', 'IT', 'ED')
         then (meta ->> 'department')::public.department_code end,
    case when meta ->> 'phone' ~ '^\+639[0-9]{9}$' then meta ->> 'phone' end
  );
  return new;
end $$;

-- ---------------------------------------------------------------- make waiting accounts visible
-- Only the `status` expression changes; the rest is migration 025 verbatim.
create or replace function public.admin_users() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', u.id, 'name', u.full_name, 'email', u.email, 'role', initcap(u.role::text),
      'course', u.course, 'year', u.year_level, 'section', u.section, 'department', u.department,
      'status', case u.status when 'active' then 'Active'
                              when 'pending_approval' then 'Pending'
                              else 'Inactive' end,
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
    'status', case u.status when 'active' then 'Active'
                            when 'pending_approval' then 'Pending'
                            else 'Inactive' end,
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
