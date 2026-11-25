-- 041 reachable service-role RPCs: wrap the private helpers in public, for service_role only.
--
-- THE BUG. Migrations 032, 035, 037 and 038 put the atomic auth/AI helpers in schema `private`, and
-- studia-api calls them with supabase-js `db.rpc("name")`. supabase-js speaks PostgREST, which only
-- sees the schemas in config.toml `[api] schemas = ["public", "graphql_public"]`. `private` is not
-- one of them, so every one of those calls came back
--
--     PGRST202  Could not find the function public.login_lock_state(p_identifier) in the schema cache
--
-- which auth-core.ts rethrows and http.ts turns into 500 UNKNOWN. The effect: password sign-in
-- (checkLock), the admin sign-in code (otp_send_wait), OTP attempt spending, the admin audit event
-- and both AI helpers all failed with "Something went wrong" before any credential was even read --
-- the admin portal could not be entered at all.
--
-- THE FIX. One thin wrapper per helper in `public`, where PostgREST can see it, each SECURITY
-- DEFINER so it may call into `private`, each revoked from public/anon/authenticated and granted
-- only to service_role. The posture is unchanged: these stay unreachable from a browser or a phone
-- (anon and authenticated hold the anon/user JWTs; only studia-api holds the service key). The
-- bodies, the policy and the tables are untouched -- 041 adds reachability, nothing else.
--
-- Exposing `private` in config.toml would have been the one-line alternative and is why it is not
-- taken: that publishes every current and future private function to the REST API at once.
--
-- EXISTING DATA. No schema change, no backfill: functions only.

-- ---------------------------------------------------------------- auth: lockout and OTP counters
create or replace function public.spend_otp_attempt(p_otp_id text) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.spend_otp_attempt(p_otp_id)
$$;
revoke execute on function public.spend_otp_attempt(text) from public, anon, authenticated;
grant  execute on function public.spend_otp_attempt(text) to service_role;

create or replace function public.record_login_attempt(
  p_identifier text, p_success boolean, p_role public.user_role, p_user_id uuid,
  p_ip inet, p_user_agent text, p_key text default null
) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.record_login_attempt(p_identifier, p_success, p_role, p_user_id, p_ip, p_user_agent, p_key)
$$;
revoke execute on function public.record_login_attempt(text, boolean, public.user_role, uuid, inet, text, text)
  from public, anon, authenticated;
grant  execute on function public.record_login_attempt(text, boolean, public.user_role, uuid, inet, text, text)
  to service_role;

create or replace function public.login_lock_state(p_identifier text) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.login_lock_state(p_identifier)
$$;
revoke execute on function public.login_lock_state(text) from public, anon, authenticated;
grant  execute on function public.login_lock_state(text) to service_role;

create or replace function public.otp_send_wait(p_email text, p_purpose public.otp_purpose) returns int
language sql volatile security definer set search_path = '' as $$
  select private.otp_send_wait(p_email, p_purpose)
$$;
revoke execute on function public.otp_send_wait(text, public.otp_purpose) from public, anon, authenticated;
grant  execute on function public.otp_send_wait(text, public.otp_purpose) to service_role;

-- ---------------------------------------------------------------- admin sign-in audit (037)
create or replace function public.audit_admin_event(p_admin uuid, p_summary text, p_ip inet) returns void
language sql volatile security definer set search_path = '' as $$
  select private.audit_admin_event(p_admin, p_summary, p_ip)
$$;
revoke execute on function public.audit_admin_event(uuid, text, inet) from public, anon, authenticated;
grant  execute on function public.audit_admin_event(uuid, text, inet) to service_role;

-- ---------------------------------------------------------------- AI atomicity (035)
create or replace function public.save_material_summary(
  p_material_id text, p_tldr text, p_bullets jsonb, p_objectives jsonb, p_count_regen boolean
) returns int
language sql volatile security definer set search_path = '' as $$
  select private.save_material_summary(p_material_id, p_tldr, p_bullets, p_objectives, p_count_regen)
$$;
revoke execute on function public.save_material_summary(text, text, jsonb, jsonb, boolean)
  from public, anon, authenticated;
grant  execute on function public.save_material_summary(text, text, jsonb, jsonb, boolean) to service_role;

create or replace function public.reserve_ai_request(
  p_user_id uuid, p_feature public.ai_feature, p_limit int,
  p_source_type public.ai_source_type default null, p_source_id text default null
) returns text
language sql volatile security definer set search_path = '' as $$
  select private.reserve_ai_request(p_user_id, p_feature, p_limit, p_source_type, p_source_id)
$$;
revoke execute on function public.reserve_ai_request(uuid, public.ai_feature, int, public.ai_source_type, text)
  from public, anon, authenticated;
grant  execute on function public.reserve_ai_request(uuid, public.ai_feature, int, public.ai_source_type, text)
  to service_role;

-- PostgREST caches the function catalogue; without this the wrappers stay invisible until it
-- happens to reload on its own.
notify pgrst, 'reload schema';
