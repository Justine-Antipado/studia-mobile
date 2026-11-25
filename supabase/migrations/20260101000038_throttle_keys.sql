-- 038 throttle keys: one mailbox, one allowance.
--
-- Gmail ignores dots and anything after a `+`, so a.b@gmail.com, ab@gmail.com and ab+x@gmail.com are
-- the same inbox written three ways. Both throttles were keyed on the literal string:
--
--   * otp_codes.email      -> the 30 s resend gap and the 10-per-hour cap could be multiplied simply
--                             by varying the dots, and each variant mails the same person.
--   * login_attempts.identifier -> and so could the 5-failures-per-minute lockout, which makes it a
--                             way around the lock that migration 032 just made reliable.
--
-- Both tables now carry a `throttle_key`: the canonical mailbox, used for counting only. The literal
-- value stays in `email` / `identifier`, because that is what the mail was sent to and what the admin
-- needs to read in the security views -- a canonicalised address in an audit trail would be a
-- different kind of wrong. studia-api computes the key with policy.ts throttleKey().
--
-- EXISTING DATA. The new columns are backfilled with the same rule, so counters do not reset. Rows
-- are rewritten once by the UPDATE; both tables are small and short-lived (codes expire in 5 minutes,
-- attempts matter for 60 seconds).

-- ---------------------------------------------------------------- columns
alter table public.otp_codes      add column if not exists throttle_key text;
alter table public.login_attempts add column if not exists throttle_key text;

comment on column public.otp_codes.throttle_key is
  'Canonical mailbox for rate limiting (gmail dots/+tags removed). Never used to send or to identify '
  'an account -- `email` is the address the code went to.';
comment on column public.login_attempts.throttle_key is
  'Canonical mailbox for the lockout. `identifier` keeps exactly what the caller typed.';

-- Same rule as policy.ts throttleKey(), for the backfill and as documentation of the rule.
create or replace function private.throttle_key(p_email text) returns text
language sql immutable set search_path = '' as $$
  select case
    when position('@' in lower(btrim(p_email))) < 2 then lower(btrim(p_email))
    when split_part(lower(btrim(p_email)), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(btrim(p_email)), '@', 1), '+', 1), '.', '')
           || '@' || split_part(lower(btrim(p_email)), '@', 2)
    else lower(btrim(p_email))
  end
$$;
grant execute on function private.throttle_key(text) to service_role;

update public.otp_codes      set throttle_key = private.throttle_key(email)      where throttle_key is null;
update public.login_attempts set throttle_key = private.throttle_key(identifier) where throttle_key is null;

create index if not exists ix_otp_throttle   on public.otp_codes (throttle_key, purpose, sent_at);
create index if not exists ix_login_throttle on public.login_attempts (throttle_key, attempted_at);

-- ---------------------------------------------------------------- count on the key
-- Migration 032's two functions, keyed on the mailbox instead of the string. p_identifier is still
-- recorded as typed; p_key is what the lock is counted against.
--
-- The 6-argument version from 032 has to be DROPPED, not replaced: `create or replace function` keys
-- on the argument list, so adding p_key would leave both versions callable and a 6-argument call
-- would silently keep using the old one, which never writes throttle_key.
drop function if exists private.record_login_attempt(text, boolean, public.user_role, uuid, inet, text);

create or replace function private.record_login_attempt(
  p_identifier text, p_success boolean, p_role public.user_role, p_user_id uuid,
  p_ip inet, p_user_agent text, p_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_window constant interval := interval '60 seconds';
  v_lock   constant interval := interval '60 seconds';
  v_max    constant int := 5;
  v_key text := coalesce(nullif(btrim(p_key), ''), private.throttle_key(p_identifier));
  v_locked_at timestamptz; v_fails int; v_locked boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext('studia.login:' || v_key));

  select attempted_at into v_locked_at
    from public.login_attempts
   where throttle_key = v_key and locked and attempted_at > now() - v_lock
   order by attempted_at desc
   limit 1;

  if v_locked_at is not null then
    insert into public.login_attempts (identifier, throttle_key, success, locked, role, user_id, ip, user_agent)
    values (p_identifier, v_key, false, false, p_role, p_user_id, p_ip, left(p_user_agent, 255));
    return jsonb_build_object('locked', true,
      'retryAfterSec', greatest(1, ceil(extract(epoch from (v_locked_at + v_lock - now()))))::int);
  end if;

  if not p_success then
    select count(*) into v_fails
      from public.login_attempts
     where throttle_key = v_key
       and attempted_at > now() - v_window
       and attempted_at > coalesce((select max(attempted_at) from public.login_attempts
                                     where throttle_key = v_key and (success or locked)), '-infinity');
    v_locked := v_fails + 1 >= v_max;
  end if;

  insert into public.login_attempts (identifier, throttle_key, success, locked, role, user_id, ip, user_agent)
  values (p_identifier, v_key, p_success, v_locked, p_role, p_user_id, p_ip, left(p_user_agent, 255));

  return jsonb_build_object('locked', v_locked,
    'retryAfterSec', case when v_locked then ceil(extract(epoch from v_lock))::int else 0 end);
end $$;

revoke execute on function private.record_login_attempt(text, boolean, public.user_role, uuid, inet, text, text)
  from public, anon, authenticated;

create or replace function private.login_lock_state(p_identifier text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select jsonb_build_object('locked', true,
             'retryAfterSec', greatest(1, ceil(extract(epoch from (attempted_at + interval '60 seconds' - now()))))::int)
    from public.login_attempts
    where throttle_key = private.throttle_key(p_identifier)
      and locked and attempted_at > now() - interval '60 seconds'
    order by attempted_at desc
    limit 1), jsonb_build_object('locked', false, 'retryAfterSec', 0))
$$;

revoke execute on function private.login_lock_state(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- OTP send allowance
-- Returns the seconds to wait (0 = may send). Counting both limits here keeps the whole decision on
-- the canonical mailbox, which is the point of this migration.
create or replace function private.otp_send_wait(p_email text, p_purpose public.otp_purpose) returns int
language plpgsql security definer set search_path = '' as $$
declare v_key text := private.throttle_key(p_email); v_last timestamptz; v_count int; v_wait int;
begin
  select max(sent_at) into v_last
    from public.otp_codes where throttle_key = v_key and purpose = p_purpose;
  v_wait := case when v_last is null then 0
            else greatest(0, ceil(extract(epoch from (v_last + interval '30 seconds' - now()))))::int end;
  if v_wait > 0 then return v_wait; end if;

  select count(*) into v_count
    from public.otp_codes where throttle_key = v_key and sent_at > now() - interval '1 hour';
  if v_count >= 10 then return 600; end if;  -- hourly cap: wait it out
  return 0;
end $$;

revoke execute on function private.otp_send_wait(text, public.otp_purpose) from public, anon, authenticated;
