-- 034 two writes the client should not have had.
--
-- 1. PUSH TOKEN TAKEOVER. register_push_token upserted `on conflict (token) do update set user_id =
--    excluded.user_id`, so any signed-in user who knew another device's Expo token could claim it.
--    The victim's phone then received the attacker's notifications (titles and bodies carry
--    announcement text, so it is a usable phishing channel) and stopped receiving its own, silently.
--    The reason for the upsert is real -- a shared phone, a second account -- so the move is kept, but
--    the old owner's registration is DELETED and re-created instead of re-pointed, and the function
--    now checks that the caller's account is active. A device that is still signed in re-registers on
--    the next launch (core/logic/push-notifications.ts), so a wrongly moved token self-heals.
--
-- 2. PROFILE EDITS WITHOUT THE EMAILED CODE. studia-api's /api/me/profile-update requires a 6-digit
--    code before a name, phone, course, year or section changes -- but migration 001 granted those
--    very columns to `authenticated`, so a client holding its own session and the public anon key
--    could write them directly and skip the code entirely. `full_name` is what identifies the author
--    of a comment to a whole class (migration 016/031), so this was impersonation on request.
--    The grant goes. Writes to public.users now happen only through studia-api with the service role,
--    which is where the OTP check lives.
--
-- EXISTING DATA. No row is touched. Revoking a privilege and replacing two functions only.

-- ---------------------------------------------------------------- 1. push tokens
create or replace function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or not private.is_active_user() then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'unknown platform' using errcode = '22023';
  end if;

  -- Hand the token over rather than re-point it: the row the other account owned is gone, so nothing
  -- of theirs (its updated_at, its history) is inherited, and the delete is what we audit against.
  delete from public.push_tokens where token = p_token and user_id <> me;

  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, me, p_platform, now())
  on conflict (token) do update
    set platform = excluded.platform, updated_at = now()
  where public.push_tokens.user_id = me;
end $$;

comment on function public.register_push_token(text, text) is
  'Registers this device for the CALLER. A token already registered to another account is released '
  'to them: the other device re-registers on its next launch.';

-- ---------------------------------------------------------------- 2. profile columns
-- `last_active_at` is written by studia-api on sign-in (service role), not by the app, so it goes too.
revoke update (full_name, phone, course, year_level, section, department, last_active_at)
  on public.users from authenticated;
revoke update on public.users from authenticated, anon;

-- With no updatable column left, the row-level policy had nothing to allow. Dropping it says so, so
-- the next reader does not take it for a write path that exists.
drop policy if exists users_update_self on public.users;

comment on table public.users is
  'Profile of auth.users. Clients READ their own row (users_select_self), their roster or instructor; '
  'they never WRITE it. Every change goes through studia-api with the service role -- /api/me/'
  'profile-update, which requires an emailed code, /api/me/avatar, or an admin_* function.';
