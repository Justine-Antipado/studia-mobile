-- 026 safer user removal for the admin portal.
--  * Deactivate (default): status = 'inactive' + auth ban + sessions revoked. Nothing is deleted, so an
--    instructor's classes (and every student's work in them) stay intact. Reversible with Reactivate.
--  * Reassign: move all of an instructor's classes to another active instructor.
--  * Delete permanently: refused for an instructor who still owns classes (even soft-deleted ones, the
--    foreign key is RESTRICT). The dialog first asks admin_user_impact() what would be lost.

create or replace function public.admin_user_impact(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u public.users;
begin
  perform private.assert_admin();
  select * into u from public.users where id = p_id and role in ('student', 'instructor');
  if not found then raise exception 'user not found' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'id', u.id, 'name', u.full_name, 'role', initcap(u.role::text),
    'classesOwned',  (select count(*) from public.classes where instructor_id = u.id),
    'activeClasses', (select count(*) from public.classes where instructor_id = u.id and deleted_at is null),
    'enrolments',    (select count(*) from public.class_enrollments where student_id = u.id and left_at is null),
    'submissions',   (select count(*) from public.assignment_submissions where student_id = u.id),
    'quizAttempts',  (select count(*) from public.quiz_attempts where student_id = u.id),
    'lessonViews',   (select count(*) from public.material_views where student_id = u.id),
    'plannerItems',  (select count(*) from public.planner_blocks b join public.planner_weeks w on w.id = b.week_id where w.student_id = u.id),
    'chatMessages',  (select count(*) from public.ai_chat_messages where user_id = u.id));
end $$;

create or replace function public.admin_set_user_active(p_ids uuid[], p_active boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[]; v_names text; v_n int;
begin
  perform private.assert_admin();
  select coalesce(array_agg(id), '{}'), string_agg(full_name, ', ') into v_ids, v_names
  from public.users where id = any(p_ids) and role in ('student', 'instructor') and deleted_at is null;
  if coalesce(array_length(v_ids, 1), 0) = 0 then return jsonb_build_object('updated', 0); end if;

  update public.users set status = (case when p_active then 'active' else 'inactive' end)::public.account_status
  where id = any(v_ids);
  get diagnostics v_n = row_count;

  update auth.users set banned_until = case when p_active then null else 'infinity'::timestamptz end where id = any(v_ids);
  if not p_active then
    delete from auth.sessions where user_id = any(v_ids);  -- also drops their refresh tokens
    delete from public.push_tokens where user_id = any(v_ids);
  end if;

  perform private.audit('update', (case when p_active then 'Reactivated ' else 'Deactivated ' end) || v_n
    || ' user account' || case when v_n = 1 then '' else 's' end || ': ' || left(v_names, 160) || '.', 'user', to_jsonb(v_ids));
  return jsonb_build_object('updated', v_n);
end $$;

create or replace function public.admin_reassign_classes(p_from uuid, p_to uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_n int; v_from text; v_to text;
begin
  perform private.assert_admin();
  if p_from = p_to then raise exception 'choose a different instructor' using errcode = '22023'; end if;
  select full_name into v_from from public.users where id = p_from and role = 'instructor';
  select full_name into v_to from public.users where id = p_to and role = 'instructor' and status = 'active' and deleted_at is null;
  if v_from is null then raise exception 'user not found' using errcode = 'P0002'; end if;
  if v_to is null then raise exception 'the new owner must be an active instructor' using errcode = '22023'; end if;
  update public.classes set instructor_id = p_to where instructor_id = p_from;
  get diagnostics v_n = row_count;
  perform private.audit('update', 'Reassigned ' || v_n || ' class' || case when v_n = 1 then '' else 'es' end
    || ' from ' || v_from || ' to ' || v_to || '.', 'class', null);
  return jsonb_build_object('moved', v_n);
end $$;

-- hard delete: now refuses instructors that still own classes
create or replace function public.admin_delete_users(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[]; v_names text; v_n int; v_blocked text;
begin
  perform private.assert_admin();
  select coalesce(array_agg(id), '{}'), string_agg(full_name, ', ') into v_ids, v_names
  from public.users where id = any(p_ids) and role in ('student', 'instructor');
  if coalesce(array_length(v_ids, 1), 0) = 0 then return jsonb_build_object('deleted', 0); end if;

  select string_agg(distinct u.full_name, ', ') into v_blocked
  from public.users u join public.classes c on c.instructor_id = u.id where u.id = any(v_ids);
  if v_blocked is not null then
    raise exception '% still own(s) classes. Reassign the classes to another instructor, or deactivate the account instead.', left(v_blocked, 120)
      using errcode = '22023';
  end if;

  delete from auth.users where id = any(v_ids);
  get diagnostics v_n = row_count;
  perform private.audit('delete', 'Permanently deleted ' || v_n || ' user account' || case when v_n = 1 then '' else 's' end
    || ': ' || left(v_names, 160) || '.', 'user', to_jsonb(v_ids));
  return jsonb_build_object('deleted', v_n);
end $$;

revoke execute on function public.admin_user_impact(uuid), public.admin_set_user_active(uuid[], boolean),
  public.admin_reassign_classes(uuid, uuid) from public, anon;
grant execute on function public.admin_user_impact(uuid), public.admin_set_user_active(uuid[], boolean),
  public.admin_reassign_classes(uuid, uuid) to authenticated;
