-- 001 identity: users (profile of auth.users), otp, tokens, sessions, login attempts.
-- Ids: users.id is a uuid shared with auth.users; every other table uses opaque text ids.

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------- shared enums
create type public.user_role      as enum ('student', 'instructor', 'admin');
create type public.account_status as enum ('active', 'inactive', 'pending_approval');
create type public.auth_provider  as enum ('password', 'google');
create type public.course_code    as enum ('BSIT', 'BEED', 'BSBA-FM', 'BSBA-OM');
create type public.year_level     as enum ('1', '2', '3', '4');
create type public.section_code   as enum ('A', 'B', 'C', 'D', 'E');
create type public.department_code as enum ('FM', 'OM', 'IT', 'ED');
create type public.otp_purpose    as enum ('signup', 'google_login', 'google_signup', 'reset', 'password_change');
create type public.auth_token_kind as enum ('reset', 'google_profile');
create type public.session_platform as enum ('web', 'android', 'ios');

-- ---------------------------------------------------------------- helpers
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- users
create table public.users (
  id                 uuid primary key references auth.users (id) on delete cascade,
  role               public.user_role not null,
  full_name          text not null check (char_length(btrim(full_name)) between 1 and 80),
  email              text not null check (email = lower(btrim(email)) and char_length(email) <= 254),
  username           text check (username ~ '^[a-z0-9_.-]{3,40}$'),
  auth_provider      public.auth_provider not null default 'password',
  course             public.course_code,
  year_level         public.year_level,
  section            public.section_code,
  department         public.department_code,
  phone              text check (phone ~ '^\+639[0-9]{9}$'),
  status             public.account_status not null default 'active',
  failed_login_count smallint not null default 0 check (failed_login_count >= 0),
  locked_until       timestamptz,
  last_active_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  -- campus domain is enforced on every new/updated row; the admin account is exempt
  constraint users_email_domain check (role = 'admin' or email like '%@omsu.edu.ph')
);
create unique index uq_users_email    on public.users (email);
create unique index uq_users_username on public.users (username) where username is not null;
create index ix_users_role_status  on public.users (role, status);
create index ix_users_cys          on public.users (course, year_level, section);
create index ix_users_last_active  on public.users (last_active_at);
create index ix_users_created      on public.users (created_at);
create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users
    where id = (select auth.uid()) and role = 'admin' and status = 'active' and deleted_at is null
  )
$$;
grant execute on function private.is_admin() to anon, authenticated, service_role;

-- A profile row is created for every auth user. The client may only ask for
-- student or instructor; admin is granted by the service role, never by metadata.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, role, full_name, email, auth_provider)
  values (
    new.id,
    case new.raw_user_meta_data ->> 'role'
      when 'instructor' then 'instructor'::public.user_role
      else 'student'::public.user_role
    end,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)), 80),
    lower(btrim(new.email)),
    case when new.raw_app_meta_data ->> 'provider' = 'google'
      then 'google'::public.auth_provider else 'password'::public.auth_provider end
  );
  return new;
end $$;
create trigger trg_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.users enable row level security;
create policy users_select_self  on public.users for select to authenticated
  using (id = (select auth.uid()));
create policy users_select_admin on public.users for select to authenticated
  using ((select private.is_admin()));
create policy users_update_self  on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- the policy above allows the row; these column grants decide WHAT may change
revoke update on public.users from authenticated, anon;
grant update (full_name, phone, course, year_level, section, department, last_active_at)
  on public.users to authenticated;
revoke insert, delete on public.users from authenticated, anon;

-- ---------------------------------------------------------------- otp + tokens (service role only)
create table public.otp_codes (
  id          text primary key default gen_random_uuid()::text,
  email       text not null,
  purpose     public.otp_purpose not null,
  code_hash   text not null,
  attempts    smallint not null default 0 check (attempts between 0 and 10),
  sent_at     timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  request_ip  inet,
  check (expires_at > sent_at)
);
create index ix_otp_email_purpose on public.otp_codes (email, purpose, sent_at);
create index ix_otp_expires       on public.otp_codes (expires_at);

create table public.auth_tokens (
  id          text primary key default gen_random_uuid()::text,
  email       text not null,
  kind        public.auth_token_kind not null,
  token_hash  text not null unique,
  payload     jsonb,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  check (expires_at > created_at)
);
create index ix_auth_tokens_email on public.auth_tokens (email, kind);

create table public.login_attempts (
  id           text primary key default gen_random_uuid()::text,
  identifier   text not null,
  user_id      uuid references public.users (id) on delete set null,
  role         public.user_role,
  success      boolean not null default false,
  locked       boolean not null default false,
  ip           inet,
  user_agent   text,
  attempted_at timestamptz not null default now()
);
create index ix_attempts_identifier on public.login_attempts (identifier, attempted_at);
create index ix_attempts_at         on public.login_attempts (attempted_at);
create index ix_attempts_user       on public.login_attempts (user_id);

alter table public.otp_codes      enable row level security;
alter table public.auth_tokens    enable row level security;
alter table public.login_attempts enable row level security;
revoke all on public.otp_codes, public.auth_tokens, public.login_attempts from anon, authenticated;
create policy login_attempts_admin_select on public.login_attempts for select to authenticated
  using ((select private.is_admin()));
grant select on public.login_attempts to authenticated;

-- ---------------------------------------------------------------- sessions (device list)
create table public.sessions (
  id             text primary key default gen_random_uuid()::text,
  user_id        uuid not null references public.users (id) on delete cascade,
  token_hash     text not null unique,
  device         text,
  browser        text,
  platform       public.session_platform not null default 'web',
  ip             inet,
  location       text,
  user_agent     text,
  created_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  expires_at     timestamptz not null,
  revoked_at     timestamptz
);
create index ix_sessions_user on public.sessions (user_id, last_active_at);

alter table public.sessions enable row level security;
revoke all on public.sessions from anon, authenticated;
grant select on public.sessions to authenticated;
create policy sessions_select_own   on public.sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy sessions_select_admin on public.sessions for select to authenticated
  using ((select private.is_admin()));
