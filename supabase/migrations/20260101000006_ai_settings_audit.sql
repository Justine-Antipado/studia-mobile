-- 006 ai, settings, audit, backups, findings, idempotency.

create type public.ai_feature     as enum ('summarizer','planner','quiz_synthesizer','chat','transcription');
create type public.ai_status      as enum ('ok', 'error', 'timeout');
create type public.ai_source_type as enum ('material','class','quiz','chat','planner');
create type public.chat_sender    as enum ('user', 'ai');
create type public.settings_section as enum ('term','email','security_policy','uploads','system','backup','legal','ai');
create type public.audit_action   as enum ('create','update','delete','settings','security');
create type public.severity_level as enum ('critical','high','medium','low');

create table public.ai_requests (
  id          text primary key default gen_random_uuid()::text,
  user_id     uuid references public.users (id) on delete set null,
  feature     public.ai_feature not null,
  status      public.ai_status not null default 'ok',
  latency_ms  integer check (latency_ms >= 0),
  source_type public.ai_source_type,
  source_id   text,
  tokens_in   integer check (tokens_in >= 0),
  tokens_out  integer check (tokens_out >= 0),
  cost_usd    numeric(10,4) check (cost_usd >= 0),
  error_code  text,
  created_at  timestamptz not null default now()
);
create index ix_ai_feature_created on public.ai_requests (feature, created_at);
create index ix_ai_user            on public.ai_requests (user_id, created_at);

create table public.ai_chat_messages (
  id         text primary key default gen_random_uuid()::text,
  user_id    uuid not null references public.users (id) on delete cascade,
  thread_id  text not null,
  sender     public.chat_sender not null,
  body       text not null check (char_length(body) between 1 and 20000),
  created_at timestamptz not null default now()
);
create index ix_chat_thread on public.ai_chat_messages (thread_id, created_at);
create index ix_chat_user   on public.ai_chat_messages (user_id, created_at);

create table public.settings (
  section    public.settings_section primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null
);
create trigger trg_settings_updated before update on public.settings
  for each row execute function public.set_updated_at();

create table public.audit_log (
  id          text primary key default gen_random_uuid()::text,
  actor_id    uuid references public.users (id) on delete set null,
  actor_name  text not null,
  action      public.audit_action not null,
  summary     text not null check (char_length(summary) <= 255),
  target_type text,
  target_ids  jsonb,
  ip          inet,
  logged_at   timestamptz not null default now()
);
create index ix_audit_action_at on public.audit_log (action, logged_at);
create index ix_audit_at        on public.audit_log (logged_at);
create index ix_audit_actor     on public.audit_log (actor_id);

create table public.backup_runs (
  id           text primary key default gen_random_uuid()::text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  size_bytes   bigint check (size_bytes >= 0),
  ok           boolean not null default false,
  note         text,
  triggered_by uuid references public.users (id) on delete set null,
  check (finished_at is null or finished_at >= started_at)
);
create index ix_backup_started on public.backup_runs (started_at);
create index ix_backup_user    on public.backup_runs (triggered_by);

create table public.security_findings (
  id             text primary key default gen_random_uuid()::text,
  title          text not null check (char_length(title) <= 140),
  category       text not null,
  severity       public.severity_level not null,
  description    text not null,
  recommendation text not null,
  detected_at    timestamptz not null default now(),
  resolved_at    timestamptz
);
create index ix_findings_severity on public.security_findings (severity, detected_at);

create table public.idempotency_keys (
  idem_key    text primary key check (char_length(idem_key) between 8 and 64),
  user_id     uuid not null references public.users (id) on delete cascade,
  endpoint    text not null,
  status_code smallint,
  response    jsonb,
  created_at  timestamptz not null default now()
);
create index ix_idem_user on public.idempotency_keys (user_id, created_at);

-- ---------------------------------------------------------------- RLS
alter table public.ai_requests      enable row level security;
alter table public.ai_chat_messages enable row level security;
alter table public.settings         enable row level security;
alter table public.audit_log        enable row level security;
alter table public.backup_runs      enable row level security;
alter table public.security_findings enable row level security;
alter table public.idempotency_keys enable row level security;

create policy ai_req_select on public.ai_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
revoke insert, update, delete on public.ai_requests from authenticated;

create policy chat_select on public.ai_chat_messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy chat_insert on public.ai_chat_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and sender = 'user');
create policy chat_delete on public.ai_chat_messages for delete to authenticated
  using (user_id = (select auth.uid()));
revoke update on public.ai_chat_messages from authenticated;

-- clients read limits and feature toggles; backup/system stay admin-only. Writes: service role.
create policy settings_select on public.settings for select to authenticated
  using (section not in ('backup', 'system') or (select private.is_admin()));
revoke insert, update, delete on public.settings from authenticated;

create policy audit_admin on public.audit_log for select to authenticated
  using ((select private.is_admin()));
create policy backup_admin on public.backup_runs for select to authenticated
  using ((select private.is_admin()));
create policy findings_admin on public.security_findings for select to authenticated
  using ((select private.is_admin()));
revoke insert, update, delete on public.audit_log, public.backup_runs, public.security_findings
  from authenticated;
-- idempotency_keys: service role only
revoke all on public.idempotency_keys from anon, authenticated;
