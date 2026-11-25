-- 037 admin sign-in, second step: audit the code as its own event.
--
-- The flow studia-api implements on top of migration 036 mirrors Google sign-in (google-start.ts):
-- the password is checked, the session Supabase minted for it is THROWN AWAY, and a 6-digit code is
-- emailed. The client only ever receives a session after that code is verified, so the code is a real
-- second factor rather than a formality.
--
-- The audit_log already recorded "Administrator signed in" when the password was accepted, which now
-- happens one step too early: at that point nobody is signed in yet. This function lets studia-api
-- record the two events separately, with the service role, so a correct password followed by a code
-- that never arrived is visible as exactly that.

create or replace function private.audit_admin_event(p_admin uuid, p_summary text, p_ip inet)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select full_name into v_name from public.users where id = p_admin and role = 'admin';
  if v_name is null then return; end if;  -- not an admin: nothing to record
  insert into public.audit_log (actor_id, actor_name, action, summary, ip)
  values (p_admin, v_name, 'security', left(p_summary, 255), p_ip);
end $$;

revoke execute on function private.audit_admin_event(uuid, text, inet) from public, anon, authenticated;
