-- 043 fixes a self-inflicted outage: admin_set_user_active() (026) banned deactivated accounts with
-- banned_until = 'infinity'::timestamptz. Postgres accepts that literal, but GoTrue's Go driver
-- cannot scan it into a time.Time ("unsupported Scan, storing driver.Value type string into type
-- *time.Time"), so it crashes before it can even read the row -- every password/Google/OTP sign-in
-- for that account fails with a raw 500 ("Database error querying schema"), not ACCOUNT_INACTIVE.
-- A concrete far-future timestamp scans fine and is effectively permanent for this app's lifetime.
create or replace function public.admin_set_user_active(p_ids uuid[], p_active boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[]; v_names text; v_n int;
begin
  perform private.assert_admin();
  select coalesce(array_agg(id), '{}'), string_agg(full_name, ', ') into v_ids, v_names
  from public.users where id = any(p_ids) and role in ('student', 'instructor') and deleted_at is null;
  if coalesce(array_length(v_ids, 1), 0) = 0 then return jsonb_build_object('updated', 0); end if;

  update public.users set status = (case when p_active then 'active' else 'inactive' end)::public.account_status
  where id = any(v_ids);
  get diagnostics v_n = row_count;

  update auth.users set banned_until = case when p_active then null else timestamptz '2099-12-31 00:00:00+00' end
  where id = any(v_ids);
  if not p_active then
    delete from auth.sessions where user_id = any(v_ids);  -- also drops their refresh tokens
    delete from public.push_tokens where user_id = any(v_ids);
  end if;

  perform private.audit('update', (case when p_active then 'Reactivated ' else 'Deactivated ' end) || v_n
    || ' user account' || case when v_n = 1 then '' else 's' end || ': ' || left(v_names, 160) || '.', 'user', to_jsonb(v_ids));
  return jsonb_build_object('updated', v_n);
end $$;

-- Already-deactivated accounts are stuck with the unscannable 'infinity' value right now; repair them
-- in place so existing deactivations keep working without the admin having to reactivate/deactivate again.
update auth.users set banned_until = timestamptz '2099-12-31 00:00:00+00' where banned_until = 'infinity';
