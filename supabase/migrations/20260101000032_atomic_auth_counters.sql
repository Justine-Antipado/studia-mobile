-- 032 atomic auth counters: make the OTP attempt cap and the login lockout hold under concurrency.
--
-- Both counters were read in one round trip and written in another, with nothing joining the two, so
-- parallel requests all saw the same "before" value:
--
--   * OTP (auth-core.ts registerWrongCode). The UPDATE was guarded by the previous value
--     (`.eq("attempts", otp.attempts)`), which does stop a lost update -- but the result was never
--     inspected, so when the guard matched zero rows the function threw the same OTP_INVALID anyway.
--     N parallel guesses advanced the counter by one instead of by N, and enough concurrency turned
--     a 5-attempt cap into an open-ended guessing game against a 6-digit code.
--   * Login (auth-core.ts checkLock + recordAttempt). Five simultaneous attempts each read an empty
--     history, each computed "not the fifth failure", and each inserted locked = false. The lock
--     never armed.
--
-- Both are now single statements that decide and record at once, and both return the decision so the
-- API reports what actually happened rather than what it predicted. The policy itself is unchanged:
-- 5 wrong codes per code, 5 failures per minute per identifier, 60 s lock (see src/lib/policy.ts).
--
-- Service role only: these tables are already unreachable from `authenticated` (migration 008), and
-- nothing is granted to anon or authenticated here.
--
-- EXISTING DATA. Read-only against existing rows; no backfill and no schema change.

-- ---------------------------------------------------------------- OTP attempts
-- One statement: bump the counter and report where it landed. `attempts` is capped at 5 by the
-- otp_attempts_max constraint from migration 009, hence the least().
create or replace function private.spend_otp_attempt(p_otp_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_attempts smallint; v_max constant smallint := 5;
begin
  update public.otp_codes
     set attempts = least(attempts + 1, v_max)
   where id = p_otp_id
  returning attempts into v_attempts;
  if v_attempts is null then
    -- The row vanished (consumed or cleaned up) while the guess was in flight.
    return jsonb_build_object('attempts', v_max, 'left', 0, 'locked', true);
  end if;
  return jsonb_build_object('attempts', v_attempts, 'left', greatest(v_max - v_attempts, 0),
                            'locked', v_attempts >= v_max);
end $$;

revoke execute on function private.spend_otp_attempt(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- login lockout
-- Records the attempt and returns the lock state, in one transaction, so the window between
-- "is it locked?" and "this one failed too" cannot be used.
--
-- Returns { locked, retryAfterSec }: `locked` true means this caller must be refused NOW -- either a
-- live lock from an earlier burst, or this failure being the fifth. A success clears nothing
-- explicitly: failureTriggersLock's equivalent below stops counting at the newest success, exactly
-- like policy.ts did.
create or replace function private.record_login_attempt(
  p_identifier text, p_success boolean, p_role public.user_role, p_user_id uuid,
  p_ip inet, p_user_agent text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_window constant interval := interval '60 seconds';
  v_lock   constant interval := interval '60 seconds';
  v_max    constant int := 5;
  v_locked_at timestamptz; v_fails int; v_locked boolean := false;
begin
  -- Serialise every decision about one identifier, so two attempts cannot both read "4 failures".
  perform pg_advisory_xact_lock(hashtext('studia.login:' || p_identifier));

  -- A lock set by an earlier attempt and still inside its minute.
  select attempted_at into v_locked_at
    from public.login_attempts
   where identifier = p_identifier and locked and attempted_at > now() - v_lock
   order by attempted_at desc
   limit 1;

  if v_locked_at is not null then
    -- Still locked: record the refusal, do not extend the lock, and report the remaining time.
    insert into public.login_attempts (identifier, success, locked, role, user_id, ip, user_agent)
    values (p_identifier, false, false, p_role, p_user_id, p_ip, left(p_user_agent, 255));
    return jsonb_build_object('locked', true,
      'retryAfterSec', greatest(1, ceil(extract(epoch from (v_locked_at + v_lock - now()))))::int);
  end if;

  if not p_success then
    -- Failures since the newest success or lock, inside the window: the same rule as
    -- policy.ts failureTriggersLock, counted in one place.
    select count(*) into v_fails
      from public.login_attempts
     where identifier = p_identifier
       and attempted_at > now() - v_window
       and attempted_at > coalesce((select max(attempted_at) from public.login_attempts
                                     where identifier = p_identifier and (success or locked)), '-infinity');
    v_locked := v_fails + 1 >= v_max;
  end if;

  insert into public.login_attempts (identifier, success, locked, role, user_id, ip, user_agent)
  values (p_identifier, p_success, v_locked, p_role, p_user_id, p_ip, left(p_user_agent, 255));

  return jsonb_build_object('locked', v_locked,
    'retryAfterSec', case when v_locked then ceil(extract(epoch from v_lock))::int else 0 end);
end $$;

revoke execute on function private.record_login_attempt(text, boolean, public.user_role, uuid, inet, text)
  from public, anon, authenticated;

-- A locked identifier is refused before the password is even checked, so the check needs its own
-- read. Kept separate from the recording function because it must not write anything.
create or replace function private.login_lock_state(p_identifier text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select jsonb_build_object('locked', true,
             'retryAfterSec', greatest(1, ceil(extract(epoch from (attempted_at + interval '60 seconds' - now()))))::int)
    from public.login_attempts
    where identifier = p_identifier and locked and attempted_at > now() - interval '60 seconds'
    order by attempted_at desc
    limit 1), jsonb_build_object('locked', false, 'retryAfterSec', 0))
$$;

revoke execute on function private.login_lock_state(text) from public, anon, authenticated;
