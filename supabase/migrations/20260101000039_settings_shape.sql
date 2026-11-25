-- 039 validate the SHAPE of the settings the admin saves, not just the lengths.
--
-- admin_save_settings (025, revised in 027) checked string lengths, the min_version format and the
-- download_url scheme. It never checked types, so `maintenance.roles` could be stored as a string or
-- an object instead of an array. public.app_status() passes those values through -- coalesce() guards
-- against MISSING, not against WRONG TYPE -- and the phone's gateFor() then calls
-- `m.roles.includes(role)` inside AppGate, at the root of the tree.
--
-- One malformed settings row would therefore throw during first render for EVERY user, and no app
-- update could fix it; only correcting the row would. The client now validates the payload too
-- (core/logic/app-status.ts parses it with zod and falls back), but a value that cannot be stored is
-- better than one every client has to defend against.
--
-- Everything else about the function is migration 027 verbatim.
--
-- EXISTING DATA. Not examined or changed: this only constrains future writes. If a bad value is
-- already stored, the client-side fallback covers it and the next save of that section fixes it.

create or replace function private.assert_settings_shape(p_section text, p_value jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare
  v_features constant text[] := array['classes','content','assessments','announcements','ai.summarizer',
                                      'ai.planner','ai.quiz','ai.chat','reports','notifications'];
  v_roles    constant text[] := array['student','instructor'];
  v_block jsonb; v_item text;
begin
  if p_section <> 'system' then return; end if;

  v_block := p_value -> 'maintenance';
  if v_block is not null then
    if jsonb_typeof(v_block) <> 'object' then
      raise exception 'the maintenance settings must be an object' using errcode = '22023';
    end if;
    if v_block ? 'enabled' and jsonb_typeof(v_block -> 'enabled') <> 'boolean' then
      raise exception 'maintenance "enabled" must be true or false' using errcode = '22023';
    end if;
    if v_block ? 'scope' and coalesce(v_block ->> 'scope', '') not in ('all', 'roles', 'features') then
      raise exception 'maintenance scope must be all, roles or features' using errcode = '22023';
    end if;
    if v_block ? 'roles' then
      if jsonb_typeof(v_block -> 'roles') <> 'array' then
        raise exception 'maintenance roles must be a list' using errcode = '22023';
      end if;
      for v_item in select jsonb_array_elements_text(v_block -> 'roles') loop
        if not (v_item = any(v_roles)) then
          raise exception 'unknown role in the maintenance settings: %', v_item using errcode = '22023';
        end if;
      end loop;
    end if;
    if v_block ? 'features' then
      if jsonb_typeof(v_block -> 'features') <> 'array' then
        raise exception 'maintenance features must be a list' using errcode = '22023';
      end if;
      for v_item in select jsonb_array_elements_text(v_block -> 'features') loop
        if not (v_item = any(v_features)) then
          raise exception 'unknown feature in the maintenance settings: %', v_item using errcode = '22023';
        end if;
      end loop;
    end if;
  end if;

  v_block := p_value -> 'update';
  if v_block is not null then
    if jsonb_typeof(v_block) <> 'object' then
      raise exception 'the update settings must be an object' using errcode = '22023';
    end if;
    if v_block ? 'required' and jsonb_typeof(v_block -> 'required') <> 'boolean' then
      raise exception 'update "required" must be true or false' using errcode = '22023';
    end if;
    if v_block ? 'scope' and coalesce(v_block ->> 'scope', '') not in ('all', 'features') then
      raise exception 'the update scope must be all or features' using errcode = '22023';
    end if;
    if v_block ? 'features' then
      if jsonb_typeof(v_block -> 'features') <> 'array' then
        raise exception 'update features must be a list' using errcode = '22023';
      end if;
      for v_item in select jsonb_array_elements_text(v_block -> 'features') loop
        if not (v_item = any(v_features)) then
          raise exception 'unknown feature in the update settings: %', v_item using errcode = '22023';
        end if;
      end loop;
    end if;
  end if;
end $$;

grant execute on function private.assert_settings_shape(text, jsonb) to service_role;

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
    -- Types and allowed values, not just sizes: this is what every phone reads on launch.
    perform private.assert_settings_shape(k, v);

    insert into public.settings (section, data, updated_by) values (k::public.settings_section, v, (select auth.uid()))
    on conflict (section) do update set data = public.settings.data || excluded.data, updated_by = excluded.updated_by, updated_at = now();
    v_changed := v_changed || (v_labels ->> k);
  end loop;
  if array_length(v_changed, 1) > 0 then
    perform private.audit('settings', 'Updated ' || array_to_string(v_changed, ', ') || '.', 'settings');
  end if;
  return coalesce((select jsonb_object_agg(section::text, data) from public.settings), '{}'::jsonb);
end $$;

-- NOTE on the merge above (`data || excluded.data`): it is SHALLOW, so a patch containing
-- {"system": {"maintenance": {"enabled": true}}} replaces the whole maintenance object and drops
-- scope, roles, features, message, starts_at and ends_at. The admin UI sends the complete section, so
-- this is correct today -- but a future partial save would lose settings silently. Left as is because
-- changing it would change what every existing caller means.
