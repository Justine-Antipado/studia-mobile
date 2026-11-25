-- 031 classmate privacy: a student may see WHO wrote a comment, not how to contact them.
--
-- WHY. Migration 016 added users_select_classmate so the class stream could show a comment author's
-- name, and its header reads "Column exposure is unchanged: RLS gates the row, and the app only
-- selects full_name". That is the gap. RLS gates ROWS; which COLUMNS a role may read is decided by
-- the grant in migration 008, which includes `email`, `phone`, `status` and `last_active_at`. A
-- client is not obliged to select only full_name, so any signed-in student could run
--
--     select full_name, email, phone from users
--
-- with the public anon key and their own session, and receive the personal Gmail address and mobile
-- number of every classmate in every class they are in. No exploit, just a query.
--
-- WHY NOT NARROW THE COLUMNS. A column grant is global to the role; it cannot be attached to one
-- policy. Revoking `email`/`phone` from `authenticated` would also break two legitimate reads:
--   * the user's OWN profile, under users_select_self
--     (studia-mobile/src/features/auth/data/remote-auth-service.ts:268 selects email and phone)
--   * an instructor's student list, under users_select_roster
--     (studia-mobile/src/features/instructor/data/students-remote.ts:14 selects email)
-- So the ROW policy goes instead, and the single thing the app needed from it -- a display name --
-- now comes from a SECURITY DEFINER function, the way public.class_classmates() (017, the People tab)
-- and public.avatar_paths() (029, profile photos) already do. Those bypass RLS and return two
-- columns, which is why the People tab needs no policy at all.
--
-- WHAT STAYS. users_select_self (own row), users_select_roster (instructor reads their students) and
-- users_select_teacher (student reads their class instructor's display name) are untouched: each is
-- narrow and each is used. Whether an instructor should see a student's email through the roster
-- policy is a separate product decision, not this migration's business.
--
-- EXISTING DATA. Nothing is read, written or migrated. Only one policy and one function change.

-- ---------------------------------------------------------------- close the row
drop policy if exists users_select_classmate on public.users;

-- ---------------------------------------------------------------- reopen the name only
-- The visibility question for a display name is the same one migration 029 already answers for a
-- photo: "do we study together?" -- me, a classmate, my instructor, or a student in a class I teach,
-- and only while my own account is active. So the predicate is reused rather than reinvented; if it
-- ever needs to change, it changes in one place for both names and faces.
-- Shape matches avatar_paths(): [{ id, name }], capped at 200 ids per call.
create or replace function public.person_names(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'name', u.full_name)), '[]'::jsonb)
  from public.users u
  where u.id = any(p_ids[1:200])
    and u.deleted_at is null
    and private.can_see_avatar(u.id)
$$;
comment on function public.person_names(uuid[]) is
  'Display names of the people the caller studies with. The only way a client learns another '
  'user''s name; no other column of public.users ever leaves through it.';

revoke execute on function public.person_names(uuid[]) from public, anon;
grant  execute on function public.person_names(uuid[]) to authenticated;
