-- 040 remove maintenance mode and the required-update rule.
--
-- The admin's Settings → System tab is gone, and with it the phone-side gates it drove
-- (core/logic/maintenance.ts, use-gate.ts, gate-views.tsx: AppGate, RouteFeatureGate, FeatureGate).
-- It was never a security boundary -- a modified client could ignore it, as the module itself said --
-- so nothing is being relied on that this removes.
--
-- WHAT STAYS, and why this is not a simple deletion:
--
--   * public.app_status() stays. It is also how the phone reads the LEGAL text (Settings → Legal),
--     which account-info-screens.tsx and explore-screen.tsx still show.
--   * It keeps returning INERT `maintenance` and `update` objects. App builds released before this
--     change read those keys without validating them -- `status.maintenance.active` on a missing key
--     is a TypeError in a gate that renders at the root of the tree. Returning constants means every
--     installed app sees "nothing is blocked" instead of crashing on launch. They can be dropped once
--     no such build is in use; the new app ignores them either way.
--   * The `settings.system` section stays. It also holds storage_quota_mb, which
--     private.storage_quota_bytes() reads for the admin's storage alert, and the timezone.
--     Only the `maintenance` and `update` keys are removed from it.
--   * private.parse_local_ts stays: it is only used here, but costs nothing and the window times it
--     parsed were the one thing in this feature that was genuinely fiddly to get right.
--
-- EXISTING DATA. The two keys are deleted from the stored `system` document. Nothing else in it is
-- touched. If maintenance was ON when this runs, it is off afterwards -- which is the point.

-- ---------------------------------------------------------------- the function
create or replace function public.app_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_legal jsonb;
begin
  select data into v_legal from public.settings where section = 'legal';

  return jsonb_build_object(
    'serverTime', now(),
    -- Kept only so pre-removal app builds read "nothing is blocked" rather than crash. Not settings.
    'maintenance', jsonb_build_object(
      'active', false, 'scope', 'all', 'roles', '[]'::jsonb, 'features', '[]'::jsonb,
      'message', '', 'endsAt', null),
    'update', jsonb_build_object(
      'required', false, 'minVersion', '', 'scope', 'all', 'features', '[]'::jsonb,
      'downloadUrl', '', 'message', ''),
    'legal', jsonb_build_object(
      'terms',     coalesce(v_legal ->> 'terms', ''),
      'privacy',   coalesce(v_legal ->> 'privacy', ''),
      'updatedAt', (select updated_at from public.settings where section = 'legal')));
end $$;

comment on function public.app_status() is
  'Public, pre-sign-in: the legal text the admin posts. The maintenance and update objects are '
  'constants kept for app builds released before migration 040 removed that feature.';

-- ---------------------------------------------------------------- stop validating what cannot be set
-- Migration 039 added shape checks for maintenance.roles / features / scope and the update block.
-- There is no UI left to write them, so the checks have nothing to guard; dropping the call keeps
-- admin_save_settings honest about what it actually enforces. Everything else is 039 verbatim.
create or replace function public.admin_save_settings(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; v jsonb; v_labels jsonb := '{"email":"the email settings","system":"the system settings","legal":"the legal text","ai":"the AI settings"}';
        v_changed text[] := '{}'; v_limit numeric;
begin
  perform private.assert_admin();
  if jsonb_typeof(p_patch) <> 'object' then raise exception 'invalid settings' using errcode = '22023'; end if;
  for k, v in select * from jsonb_each(p_patch) loop
    if not (v_labels ? k) then raise exception 'unknown settings section: %', k using errcode = '22023'; end if;
    if jsonb_typeof(v) <> 'object' then raise exception 'invalid % settings', k using errcode = '22023'; end if;
    if k = 'legal' and (char_length(coalesce(v ->> 'terms', '')) > 20000 or char_length(coalesce(v ->> 'privacy', '')) > 20000) then
      raise exception 'legal text is too long' using errcode = '22023';
    end if;
    if k = 'ai' and v ? 'daily_request_limit' then
      v_limit := (v ->> 'daily_request_limit')::numeric;
      if v_limit is null or v_limit < 1 or v_limit > 1000000 or v_limit <> trunc(v_limit) then
        raise exception 'daily request limit must be a whole number between 1 and 1,000,000' using errcode = '22023';
      end if;
    end if;
    if k = 'system' and v ? 'storage_quota_mb' then
      if (v ->> 'storage_quota_mb') !~ '^\d{1,7}$' or (v ->> 'storage_quota_mb')::bigint < 1 then
        raise exception 'the storage quota must be a whole number of megabytes' using errcode = '22023';
      end if;
    end if;

    insert into public.settings (section, data, updated_by) values (k::public.settings_section, v, (select auth.uid()))
    on conflict (section) do update set data = public.settings.data || excluded.data, updated_by = excluded.updated_by, updated_at = now();
    v_changed := v_changed || (v_labels ->> k);
  end loop;
  if array_length(v_changed, 1) > 0 then
    perform private.audit('settings', 'Updated ' || array_to_string(v_changed, ', ') || '.', 'settings');
  end if;
  return coalesce((select jsonb_object_agg(section::text, data) from public.settings), '{}'::jsonb);
end $$;

drop function if exists private.assert_settings_shape(text, jsonb);

-- ---------------------------------------------------------------- clear the stored window
-- `-` on a jsonb object removes a key, so the rest of the system document (storage_quota_mb,
-- timezone, anything else) is preserved exactly.
update public.settings
   set data = (data - 'maintenance') - 'update' - 'maintenance_mode',
       updated_at = now()
 where section = 'system'
   and (data ? 'maintenance' or data ? 'update' or data ? 'maintenance_mode');
