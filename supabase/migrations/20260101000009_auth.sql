-- 009 auth (phase 3): campus-domain enforcement in Auth itself, signup metadata -> profile,
-- Google profile completion flag, OTP attempt counters.

-- ---------------------------------------------------------------- domain gate (server side)
-- The campus does not own a mail domain we can use, so any Google account (@gmail.com) is allowed
-- next to @omsu.edu.ph (seeded users). The table constraint is widened to match.
alter table public.users drop constraint users_email_domain;
alter table public.users add constraint users_email_domain
  check (role = 'admin' or email ~ '@(gmail\.com|omsu\.edu\.ph)$');

-- Wired as the Auth "Before User Created" hook (supabase/config.toml). It runs for email signups AND
-- Google sign-ins, so a client that skips our UI or our API still cannot create a non-campus account.
create function private.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if v_email ~ '^[a-z0-9._+-]{1,64}@(gmail\.com|omsu\.edu\.ph)$' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'message', 'Use a Gmail (@gmail.com) or @omsu.edu.ph email.',
    'http_code', 400));
end $$;

revoke all on function private.hook_before_user_created(jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema private to supabase_auth_admin;
    grant execute on function private.hook_before_user_created(jsonb) to supabase_auth_admin;
  end if;
end $$;

-- ---------------------------------------------------------------- profile completion (Google)
-- Google sign-ups arrive without role/course/etc. They stay profile_completed = false until
-- the server function `complete-profile` fills them in (the client may not write role).
alter table public.users add column profile_completed boolean not null default true;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_google boolean := coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google';
  v_role   public.user_role := case meta ->> 'role'
             when 'instructor' then 'instructor'::public.user_role
             else 'student'::public.user_role end;  -- admin is never grantable via metadata
begin
  insert into public.users (id, role, full_name, email, auth_provider, profile_completed,
                            course, year_level, section, department, phone)
  values (
    new.id,
    v_role,
    left(coalesce(nullif(btrim(coalesce(meta ->> 'full_name', meta ->> 'name')), ''),
                  split_part(new.email, '@', 1)), 80),
    lower(btrim(new.email)),
    case when v_google then 'google'::public.auth_provider else 'password'::public.auth_provider end,
    not v_google,
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

-- ---------------------------------------------------------------- OTP counters
-- Supabase Auth owns the code itself (and its hash). This table only carries what Auth cannot:
-- a per-code wrong-attempt counter (max 5) and the 30 s resend throttle. Written by the service role only.
alter table public.otp_codes alter column code_hash drop not null;
comment on column public.otp_codes.code_hash is 'Unused with Supabase Auth OTP (Auth stores the hash). Kept nullable for a custom sender.';
alter table public.otp_codes add constraint otp_attempts_max check (attempts <= 5);
