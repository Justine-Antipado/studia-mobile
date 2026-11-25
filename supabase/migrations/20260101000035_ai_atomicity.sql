-- 035 AI bookkeeping that holds under concurrency.
--
-- 1. SUMMARY WRITE WAS NOT ATOMIC (src/ai/summarize.ts). Three separate round trips: upsert the
--    summary, delete every objective, insert the new ones -- with the insert's error never checked.
--    If it failed, the objectives were gone and the endpoint still answered 200 with them in the
--    body, so the client showed objectives that no longer existed. Two concurrent regenerations
--    interleaved as delete/delete/insert/insert and left two rows per position, which nothing
--    forbade. All three steps are one function (one transaction) now, and a unique index makes a
--    duplicate position impossible rather than merely unlikely.
--
-- 2. REGENERATION CAP WAS A LOST UPDATE. `regen_count` was read before the AI call (seconds earlier)
--    and written back as `read + 1`, so two parallel regenerations both read 0 and both wrote 1. The
--    column already carries `check (regen_count between 0 and 3)` from migration 014, so the cap only
--    ever needed to be counted in the database: `regen_count + 1` under a row lock, with a readable
--    error instead of a raw constraint violation.
--
-- 3. AI QUOTA COUNTED ONLY FINISHED CALLS (src/lib/ai-guard.ts). assertAiQuota counted rows in
--    ai_requests, but the row for the call being made was inserted by logAi AFTER the provider
--    answered -- so for the several seconds a call takes it was invisible, and a burst of parallel
--    requests all passed the same check. The row is now reserved BEFORE the provider is called, which
--    is what makes the hourly limit real, and updated with the outcome afterwards.
--
-- EXISTING DATA. One index is added, and duplicate objectives are removed first so adding it cannot
-- fail (there should be none unless a regeneration has already raced). Nothing else is rewritten.

-- ---------------------------------------------------------------- 1 + 2. summaries and objectives
-- Same position twice for one material was always a bug; now it cannot be stored.
delete from public.material_objectives o
 using public.material_objectives keep
 where o.material_id = keep.material_id
   and o.position = keep.position
   and o.id > keep.id;

create unique index if not exists uq_objectives_material_position
  on public.material_objectives (material_id, position);

-- The whole summary write as one statement-set: the summary row, the regeneration count and the
-- objectives either all land or none do.
--   p_count_regen  true for a student's re-run (the capped kind), false for the class owner's
-- Returns the resulting regen_count.
create or replace function private.save_material_summary(
  p_material_id text, p_tldr text, p_bullets jsonb, p_objectives jsonb, p_count_regen boolean
) returns int
language plpgsql security definer set search_path = '' as $$
declare v_max constant int := 3; v_prev int; v_regen int;
begin
  -- Lock the existing row, so two regenerations cannot both read the same count.
  select regen_count into v_prev
    from public.material_summaries
   where material_id = p_material_id and mode = 'bullets' and source_version = 1
   for update;

  if p_count_regen and coalesce(v_prev, 0) >= v_max then
    raise exception 'You can regenerate this summary % times. The limit was reached.', v_max
      using errcode = '22023';
  end if;

  insert into public.material_summaries (material_id, mode, source_version, tldr, bullets, regen_count, generated_at)
  values (p_material_id, 'bullets', 1, left(p_tldr, 500), p_bullets, 0, now())
  on conflict (material_id, mode, source_version) do update
    set tldr         = excluded.tldr,
        bullets      = excluded.bullets,
        generated_at = now(),
        regen_count  = public.material_summaries.regen_count + case when p_count_regen then 1 else 0 end
  returning regen_count into v_regen;

  delete from public.material_objectives where material_id = p_material_id;
  insert into public.material_objectives (material_id, position, body)
  select p_material_id, (t.ord - 1)::smallint, left(t.value, 500)
    from jsonb_array_elements_text(coalesce(p_objectives, '[]'::jsonb)) with ordinality as t(value, ord)
   where btrim(t.value) <> '';

  return v_regen;
end $$;

revoke execute on function private.save_material_summary(text, text, jsonb, jsonb, boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------- 3. AI quota
-- Reserves this call's slot and returns the ai_requests row to finish later. Raises 22023 when the
-- caller is at the hourly limit for the feature, counting calls still in flight.
create or replace function private.reserve_ai_request(
  p_user_id uuid, p_feature public.ai_feature, p_limit int,
  p_source_type public.ai_source_type default null, p_source_id text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare v_used int; v_id text;
begin
  -- One decision at a time per user+feature, so a burst cannot all read the same count.
  perform pg_advisory_xact_lock(hashtext('studia.ai:' || p_user_id::text || ':' || p_feature::text));

  select count(*) into v_used
    from public.ai_requests
   where user_id = p_user_id and feature = p_feature and created_at > now() - interval '1 hour';

  if v_used >= p_limit then
    raise exception 'ai quota reached' using errcode = '22023';
  end if;

  -- Inserted as 'ok' and corrected on failure: a reservation has to be visible to the next caller's
  -- count immediately, and 'ok' is the only status that does not page the admins (see the trigger
  -- below, which now also fires when this row is updated to 'error').
  insert into public.ai_requests (user_id, feature, status, source_type, source_id)
  values (p_user_id, p_feature, 'ok', p_source_type, p_source_id)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function private.reserve_ai_request(uuid, public.ai_feature, int, public.ai_source_type, text)
  from public, anon, authenticated;

-- The admin inbox used to learn about a failure from the INSERT, which is now the reservation and
-- always says 'ok'. The outcome arrives as an UPDATE, so the trigger has to watch that too.
-- notify_admins still de-duplicates to one message an hour per feature.
drop trigger if exists trg_admin_ai_failed on public.ai_requests;
create trigger trg_admin_ai_failed after insert or update of status on public.ai_requests
  for each row execute function private.trg_admin_ai_failed();
