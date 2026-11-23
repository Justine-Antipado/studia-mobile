-- 027 app status: what the mobile app reads on launch and while it runs.
--
-- Migration 008 hides the `system` settings from clients (they hold backup/version internals), so the app
-- cannot read the admin's maintenance window from `settings` directly. public.app_status() is the one
-- public door: it returns only what a phone needs, already evaluated against the clock:
--   maintenance  the admin's window (Settings > System) + whether it is open right now
--   update       "installed apps older than minVersion cannot use <everything | these features>"
--   legal        terms + privacy text the admin posts (Settings > Legal)
-- It is callable before sign-in (the welcome and login screens must be blockable too) and exposes no
-- user data. Window times typed in the admin are Manila local time (settings.system.timezone).

create or replace function private.parse_local_ts(p text) returns timestamptz
language plpgsql immutable set search_path = '' as $$
begin
  if p is null or btrim(p) = '' then return null; end if;
  return (btrim(p)::timestamp) at time zone 'Asia/Manila';
exception when others then
  return null;
end $$;

create or replace function public.app_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_sys jsonb; v_legal jsonb; v_m jsonb; v_u jsonb;
  v_starts timestamptz; v_ends timestamptz; v_open boolean;
begin
  select data into v_sys   from public.settings where section = 'system';
  select data into v_legal from public.settings where section = 'legal';
  v_m := coalesce(v_sys -> 'maintenance', '{}'::jsonb);
  v_u := coalesce(v_sys -> 'update', '{}'::jsonb);
  v_starts := private.parse_local_ts(v_m ->> 'starts_at');
  v_ends   := private.parse_local_ts(v_m ->> 'ends_at');
  v_open := coalesce((v_m ->> 'enabled')::boolean, coalesce((v_sys ->> 'maintenance_mode')::boolean, false))
            and (v_starts is null or now() >= v_starts)
            and (v_ends is null or now() < v_ends);

  return jsonb_build_object(
    'serverTime', now(),
    'maintenance', jsonb_build_object(
      'active',   v_open,
      'scope',    case when v_m ->> 'scope' in ('all', 'roles', 'features') then v_m ->> 'scope' else 'all' end,
      'roles',    coalesce(v_m -> 'roles', '[]'::jsonb),
      'features', coalesce(v_m -> 'features', '[]'::jsonb),
      'message',  coalesce(v_m ->> 'message', ''),
      'endsAt',   v_ends),
    'update', jsonb_build_object(
      'required',    coalesce((v_u ->> 'required')::boolean, false),
      'minVersion',  coalesce(v_u ->> 'min_version', ''),
      'scope',       case when v_u ->> 'scope' = 'features' then 'features' else 'all' end,
      'features',    coalesce(v_u -> 'features', '[]'::jsonb),
      'downloadUrl', coalesce(v_u ->> 'download_url', ''),
      'message',     coalesce(v_u ->> 'message', '')),
    'legal', jsonb_build_object(
      'terms',     coalesce(v_legal ->> 'terms', ''),
      'privacy',   coalesce(v_legal ->> 'privacy', ''),
      'updatedAt', (select updated_at from public.settings where section = 'legal')));
end $$;

revoke execute on function public.app_status() from public;
grant execute on function public.app_status() to anon, authenticated;

-- admin_save_settings: same as 025, plus checks for the new system.update block
create or replace function public.admin_save_settings(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; v jsonb; v_labels jsonb := '{"email":"the email settings","system":"the system settings","legal":"the legal text","ai":"the AI settings"}';
        v_changed text[] := '{}'; v_limit numeric; v_url text;
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
    if k = 'system' then
      if char_length(coalesce(v #>> '{maintenance,message}', '')) > 500 then
        raise exception 'maintenance message is too long' using errcode = '22023';
      end if;
      if v ? 'update' then
        if coalesce((v #>> '{update,required}')::boolean, false) and (v #>> '{update,min_version}') !~ '^\d{1,4}\.\d{1,4}\.\d{1,4}$' then
          raise exception 'the minimum version must look like 1.2.0' using errcode = '22023';
        end if;
        v_url := coalesce(v #>> '{update,download_url}', '');
        if v_url <> '' and v_url !~* '^https://[^\s]+$' then
          raise exception 'the download link must start with https://' using errcode = '22023';
        end if;
        if char_length(coalesce(v #>> '{update,message}', '')) > 500 then
          raise exception 'the update message is too long' using errcode = '22023';
        end if;
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
