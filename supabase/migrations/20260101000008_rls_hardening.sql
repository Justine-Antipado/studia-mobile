-- 008 phase 2: RLS hardening (found by supabase/tests/rls, run `npm test` there).
--  * admin has NO direct data access: the admin dashboard goes through studia-api with the service role
--  * anon holds no table privileges; the private schema is not reachable by anon
--  * a deactivated account loses class access immediately (not when its JWT expires)
--  * answer keys are revealed only once a student is finished with the quiz
--  * file_id references must point at files the caller uploaded
--  * lockout counters / session token hashes are not readable by clients

-- ---------------------------------------------------------------- anon: nothing
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
revoke usage on schema private from anon;
revoke execute on all functions in schema private from anon, public;
grant  execute on all functions in schema private to authenticated, service_role;

-- ---------------------------------------------------------------- helpers
create function private.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users
                 where id = (select auth.uid()) and status = 'active' and deleted_at is null)
$$;
-- a file reference is valid if empty or uploaded by the caller (stops claiming someone else's file id)
create function private.owns_file(fid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select fid is null or exists (select 1 from public.files
                                where id = fid and uploaded_by = (select auth.uid()))
$$;
create function private.attempt_matches_question(aid text, qid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.quiz_attempts a
                 join public.quiz_questions q on q.quiz_id = a.quiz_id
                 where a.id = aid and q.id = qid)
$$;
-- keys: only after the student submitted AND has no attempt left (or the quiz is past due)
create function private.can_see_answer_key(qid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.quizzes q
    where q.id = qid and q.deleted_at is null
      and exists (select 1 from public.quiz_attempts a
                  where a.quiz_id = q.id and a.student_id = (select auth.uid()) and a.submitted_at is not null)
      and (coalesce(q.due_at < now(), false)
           or (select count(*) from public.quiz_attempts a
               where a.quiz_id = q.id and a.student_id = (select auth.uid()) and a.submitted_at is not null)
              >= q.max_attempts)
  )
$$;
grant execute on function private.is_active_user(), private.owns_file(text),
  private.attempt_matches_question(text, text), private.can_see_answer_key(text)
  to authenticated, service_role;

-- spec names for the role helpers
create function private.is_instructor_of(cid text) returns boolean
language sql stable security definer set search_path = '' as $$ select private.is_class_owner(cid) $$;
create function private.is_enrolled(cid text) returns boolean
language sql stable security definer set search_path = '' as $$ select private.is_class_member(cid) $$;
grant execute on function private.is_instructor_of(text), private.is_enrolled(text) to authenticated, service_role;

-- active-account + no admin short-cut
create or replace function private.is_class_owner(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists (
    select 1 from public.classes
    where id = cid and instructor_id = (select auth.uid()) and deleted_at is null)
$$;
create or replace function private.is_class_member(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and exists (
    select 1 from public.class_enrollments e
    join public.classes c on c.id = e.class_id and c.deleted_at is null
    where e.class_id = cid and e.student_id = (select auth.uid()) and e.left_at is null)
$$;
create or replace function private.can_access_class(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_class_owner(cid) or private.is_class_member(cid)
$$;
create or replace function private.can_read_material(mid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.materials m
    where m.id = mid and m.deleted_at is null
      and (private.is_class_owner(m.class_id)
           or (m.processing = 'ready' and private.is_class_member(m.class_id))))
$$;
create or replace function private.can_read_quiz(qid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.quizzes q
    where q.id = qid and q.deleted_at is null
      and (private.is_class_owner(q.class_id)
           or (q.status = 'published' and private.is_class_member(q.class_id))))
$$;

-- ---------------------------------------------------------------- users / sessions / login attempts
drop policy users_select_admin on public.users;
revoke select on public.users from authenticated;
grant select (id, role, full_name, email, username, auth_provider, course, year_level, section,
              department, phone, status, last_active_at, created_at, updated_at)
  on public.users to authenticated;  -- failed_login_count, locked_until, deleted_at stay server-side

drop policy login_attempts_admin_select on public.login_attempts;
revoke select on public.login_attempts from authenticated;

drop policy sessions_select_admin on public.sessions;
revoke select on public.sessions from authenticated;
grant select (id, user_id, device, browser, platform, ip, location, user_agent, created_at,
              last_active_at, expires_at, revoked_at)
  on public.sessions to authenticated;  -- token_hash stays server-side

-- ---------------------------------------------------------------- classes: soft delete through an owner-checked RPC
-- (a direct "set deleted_at" UPDATE fails its own RLS check: the new row is no longer visible to classes_select)
revoke update on public.classes from authenticated;
grant update (subject_code, title, course, year_level, section, school_year, semester, archived)
  on public.classes to authenticated;
create function public.delete_class(p_class_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_class_owner(p_class_id) then
    raise exception 'not the owner of this class' using errcode = '42501';
  end if;
  update public.classes set deleted_at = now() where id = p_class_id;
end $$;
revoke execute on function public.delete_class(text) from public, anon;
grant  execute on function public.delete_class(text) to authenticated;

-- ---------------------------------------------------------------- files
drop policy files_select_own on public.files;
create policy files_select_own on public.files for select to authenticated
  using (uploaded_by = (select auth.uid()));

-- ---------------------------------------------------------------- materials
drop policy materials_write_owner on public.materials;
create policy materials_insert_owner on public.materials for insert to authenticated
  with check (private.is_class_owner(class_id) and owner_id = (select auth.uid())
              and processing = 'processing' and private.owns_file(file_id));
create policy materials_update_owner on public.materials for update to authenticated
  using (private.is_class_owner(class_id))
  with check (private.is_class_owner(class_id));
create policy materials_delete_owner on public.materials for delete to authenticated
  using (private.is_class_owner(class_id));

-- only enrolled students produce view/progress rows (instructors' own opens must not skew analytics)
drop policy views_select on public.material_views;
create policy views_select on public.material_views for select to authenticated
  using (student_id = (select auth.uid())
         or private.is_class_owner(private.material_class(material_id)));
drop policy views_insert on public.material_views;
create policy views_insert on public.material_views for insert to authenticated
  with check (student_id = (select auth.uid())
              and private.is_class_member(private.material_class(material_id))
              and private.can_read_material(material_id));

-- ---------------------------------------------------------------- assignments
drop policy asgatt_write on public.assignment_attachments;
create policy asgatt_write on public.assignment_attachments for all to authenticated
  using (private.is_class_owner(private.assignment_class(assignment_id)))
  with check (private.is_class_owner(private.assignment_class(assignment_id)) and private.owns_file(file_id));

drop policy asub_select on public.assignment_submissions;
create policy asub_select on public.assignment_submissions for select to authenticated
  using (student_id = (select auth.uid())
         or private.is_class_owner(private.assignment_class(assignment_id)));
drop policy asub_insert on public.assignment_submissions;
create policy asub_insert on public.assignment_submissions for insert to authenticated
  with check (student_id = (select auth.uid()) and status = 'draft' and score is null
              and graded_at is null and submitted_at is null
              and private.owns_file(file_id)
              and private.is_class_member(private.assignment_class(assignment_id)));
drop policy asub_update on public.assignment_submissions;
create policy asub_update on public.assignment_submissions for update to authenticated
  using (student_id = (select auth.uid()) and status = 'draft')
  with check (student_id = (select auth.uid()) and status = 'draft' and score is null
              and graded_at is null and private.owns_file(file_id));

-- ---------------------------------------------------------------- quizzes
drop policy qk_select on public.quiz_question_keys;
create policy qk_select on public.quiz_question_keys for select to authenticated
  using (private.is_class_owner(private.quiz_class(private.question_quiz(question_id)))
         or private.can_see_answer_key(private.question_quiz(question_id)));
drop function private.has_submitted_quiz(text);

drop policy qa_select on public.quiz_attempts;
create policy qa_select on public.quiz_attempts for select to authenticated
  using (student_id = (select auth.uid())
         or private.is_class_owner(private.quiz_class(quiz_id)));

drop policy ans_select on public.quiz_answers;
create policy ans_select on public.quiz_answers for select to authenticated
  using (exists (select 1 from public.quiz_attempts a
                 where a.id = attempt_id
                   and (a.student_id = (select auth.uid())
                        or private.is_class_owner(private.quiz_class(a.quiz_id)))));
drop policy ans_insert on public.quiz_answers;
create policy ans_insert on public.quiz_answers for insert to authenticated
  with check (private.attempt_owner_open(attempt_id)
              and private.attempt_matches_question(attempt_id, question_id)
              and is_correct is null and awarded_points is null);

-- ---------------------------------------------------------------- platform: no admin short-cuts, no client reads of server tables
drop policy ai_req_select on public.ai_requests;
create policy ai_req_select on public.ai_requests for select to authenticated
  using (user_id = (select auth.uid()));

drop policy platform_ann_select on public.platform_announcements;
create policy platform_ann_select on public.platform_announcements for select to authenticated
  using (deleted_at is null and status = 'published' and (
           audience = 'all'
           or (audience = 'students'    and (select private.user_role()) = 'student')
           or (audience = 'instructors' and (select private.user_role()) = 'instructor')
           or (audience = 'course'      and course = (select private.user_course()))));

drop policy settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated
  using (section not in ('backup', 'system'));

drop policy audit_admin    on public.audit_log;
drop policy backup_admin   on public.backup_runs;
drop policy findings_admin on public.security_findings;
revoke select on public.audit_log, public.backup_runs, public.security_findings from authenticated;

-- ---------------------------------------------------------------- enrolments: drop the admin clause too
drop policy enroll_select on public.class_enrollments;
create policy enroll_select on public.class_enrollments for select to authenticated
  using (student_id = (select auth.uid()) or private.is_class_owner(class_id));
