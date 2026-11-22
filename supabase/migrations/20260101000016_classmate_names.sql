-- 016 classmate names: a student may read the profile row of someone enrolled in the same class
-- (and the class instructor already has users_select_teacher). The mobile app needs this to show
-- who wrote an announcement comment. Column exposure is unchanged: RLS gates the row, and the
-- app only selects full_name.
create function private.shares_class_with(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.class_enrollments mine
    join public.class_enrollments theirs on theirs.class_id = mine.class_id
    where mine.student_id = (select auth.uid()) and mine.left_at is null
      and theirs.student_id = uid and theirs.left_at is null
  )
$$;
grant execute on function private.shares_class_with(uuid) to authenticated, service_role;

create policy users_select_classmate on public.users for select to authenticated
  using (deleted_at is null and private.shares_class_with(id));
