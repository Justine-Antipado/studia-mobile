-- 019: push notifications. The app registers an Expo push token per device; every new row in
-- `notifications` (created by the triggers in 017) is forwarded to the `send-push` Edge Function,
-- which delivers it through Expo's push service.

-- ---------------------------------------------------------------- tokens
create table public.push_tokens (
  token      text primary key check (char_length(token) between 10 and 200),
  user_id    uuid not null references public.users (id) on delete cascade,
  platform   text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index ix_push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
-- Clients never write the table directly: a token can move between accounts on a shared phone, so
-- registration goes through the SECURITY DEFINER functions below.
revoke all on public.push_tokens from anon, authenticated;
grant select on public.push_tokens to authenticated;
create policy push_tokens_select on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));

create function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

create function public.unregister_push_token(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end $$;

revoke execute on function public.register_push_token(text, text), public.unregister_push_token(text)
  from public, anon;
grant execute on function public.register_push_token(text, text), public.unregister_push_token(text)
  to authenticated;

-- ---------------------------------------------------------------- forward new notifications
create extension if not exists pg_net with schema extensions;

-- The function URL and shared secret live in Supabase Vault (see supabase/functions/send-push/README.md).
-- Missing secrets or a failed call must never block the insert that created the notification.
create function private.trg_push_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then return null; end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := jsonb_build_object('notification_id', new.id),
    timeout_milliseconds := 3000
  );
  return null;
exception when others then
  return null;
end $$;

create trigger trg_push_notification after insert on public.notifications
  for each row execute function private.trg_push_notification();
