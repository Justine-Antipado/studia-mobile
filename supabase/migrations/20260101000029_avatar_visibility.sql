-- 029 avatars for the people you study with.
-- Photos live in the PRIVATE `avatars` bucket (migration 015) and until now only their owner could get a
-- signed URL (through studia-api). Classmates, the instructor and the students of an instructor's classes
-- now see each other's photos, and nobody else does:
--   private.can_see_avatar(uid)  me, a classmate, my instructor, or a student in a class I teach
--   storage policy               lets those people create a signed URL for that user's folder
--   public.avatar_paths(ids)     the object path per visible user, so the app can sign them in one batch
-- Only active accounts see anything. The path never leaves the database for people who may not see it.

create or replace function private.can_see_avatar(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_active_user() and (
    uid = (select auth.uid())
    or private.shares_class_with(uid)
    or exists (select 1 from public.class_enrollments e join public.classes c on c.id = e.class_id
               where e.student_id = uid and e.left_at is null and c.deleted_at is null
                 and c.instructor_id = (select auth.uid()))
    or exists (select 1 from public.class_enrollments e join public.classes c on c.id = e.class_id
               where e.student_id = (select auth.uid()) and e.left_at is null and c.deleted_at is null
                 and c.instructor_id = uid)
  )
$$;

-- bucket folder -> uuid, false for anything that is not one
create or replace function private.avatar_folder_visible(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return private.can_see_avatar(split_part(object_name, '/', 1)::uuid);
exception when others then
  return false;
end $$;

grant execute on function private.can_see_avatar(uuid), private.avatar_folder_visible(text) to authenticated, service_role;

create policy studia_read_avatars on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and private.avatar_folder_visible(name));

create or replace function public.avatar_paths(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'path', u.avatar_path)), '[]'::jsonb)
  from public.users u
  where u.id = any(p_ids[1:200]) and u.avatar_path is not null and u.deleted_at is null and private.can_see_avatar(u.id)
$$;
revoke execute on function public.avatar_paths(uuid[]) from public, anon;
grant execute on function public.avatar_paths(uuid[]) to authenticated;
