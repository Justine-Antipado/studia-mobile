-- 003 content: files (Supabase Storage metadata), materials, AI derivatives, views.

create type public.file_kind        as enum ('pdf', 'image', 'video', 'doc', 'slide');
create type public.scan_result      as enum ('clean', 'infected', 'error');
create type public.material_kind    as enum ('video', 'pdf', 'slide');
create type public.processing_state as enum ('processing', 'ready', 'failed');
create type public.summary_mode     as enum ('tldr', 'bullets', 'mindmap');

-- Private storage buckets; clients get short-lived signed URLs from studia-api.
-- NOTE: the Supabase free plan caps any single upload at 50 MB regardless of
-- file_size_limit; the 500 MB video cap needs the Pro plan or chunked/resumable upload.
insert into storage.buckets (id, name, public, file_size_limit)
values ('materials',   'materials',   false, 524288000),
       ('submissions', 'submissions', false,  52428800)
on conflict (id) do nothing;

create table public.files (
  id              text primary key default gen_random_uuid()::text,
  original_name   text not null check (char_length(original_name) between 1 and 120),
  bucket          text not null check (bucket in ('materials', 'submissions')),
  object_path     text not null,
  kind            public.file_kind not null,
  extension       text not null check (extension in ('pdf','doc','docx','ppt','pptx','mp4','mov','jpg','jpeg','png')),
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes >= 0),
  checksum_sha256 text check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  scanned_at      timestamptz,
  scan_result     public.scan_result,
  uploaded_by     uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (bucket, object_path)
);
create index ix_files_uploader on public.files (uploaded_by);

create table public.materials (
  id               text primary key default gen_random_uuid()::text,
  class_id         text not null references public.classes (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 140),
  kind             public.material_kind not null,
  file_id          text references public.files (id) on delete set null,
  duration_sec     integer check (duration_sec >= 0),
  processing       public.processing_state not null default 'processing',
  processing_error text,
  attempt_count    smallint not null default 0 check (attempt_count >= 0),
  owner_id         uuid references public.users (id) on delete set null,
  posted_at        timestamptz not null default now(),
  deleted_at       timestamptz
);
create index ix_materials_class      on public.materials (class_id, posted_at);
create index ix_materials_processing on public.materials (processing);
create index ix_materials_owner      on public.materials (owner_id);
create index ix_materials_file       on public.materials (file_id);

create table public.material_transcript_lines (
  id          text primary key default gen_random_uuid()::text,
  material_id text not null references public.materials (id) on delete cascade,
  start_sec   integer not null check (start_sec >= 0),
  body        text not null
);
create index ix_transcript_material on public.material_transcript_lines (material_id, start_sec);

create table public.material_objectives (
  id          text primary key default gen_random_uuid()::text,
  material_id text not null references public.materials (id) on delete cascade,
  position    smallint not null default 0 check (position >= 0),
  body        text not null check (char_length(body) <= 500)
);
create index ix_objectives_material on public.material_objectives (material_id, position);

create table public.material_summaries (
  id             text primary key default gen_random_uuid()::text,
  material_id    text not null references public.materials (id) on delete cascade,
  mode           public.summary_mode not null,
  tldr           text check (char_length(tldr) <= 500),
  bullets        jsonb,
  mindmap        jsonb,
  source_version integer not null default 1 check (source_version >= 1),
  generated_at   timestamptz not null default now(),
  unique (material_id, mode, source_version)
);

-- class progress = completed / total ready materials; engagement and consumption derive
-- from the same rows (views, not stored columns).
create table public.material_views (
  id            text primary key default gen_random_uuid()::text,
  material_id   text not null references public.materials (id) on delete cascade,
  student_id    uuid not null references public.users (id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  watch_seconds integer not null default 0 check (watch_seconds >= 0),
  completed_at  timestamptz,
  view_count    integer not null default 1 check (view_count >= 1),
  unique (material_id, student_id)
);
create index ix_view_student on public.material_views (student_id, last_seen_at);

-- ---------------------------------------------------------------- helpers
create function private.material_class(mid text) returns text
language sql stable security definer set search_path = '' as $$
  select class_id from public.materials where id = mid
$$;
create function private.can_read_material(mid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.materials m
    where m.id = mid and m.deleted_at is null
      and (private.is_class_owner(m.class_id) or private.is_admin()
           or (m.processing = 'ready' and private.is_class_member(m.class_id)))
  )
$$;
grant execute on function private.material_class(text), private.can_read_material(text)
  to authenticated, service_role;

-- ---------------------------------------------------------------- RLS
alter table public.files                     enable row level security;
alter table public.materials                 enable row level security;
alter table public.material_transcript_lines enable row level security;
alter table public.material_objectives       enable row level security;
alter table public.material_summaries        enable row level security;
alter table public.material_views            enable row level security;

-- files: uploader and admin here; readers via class access are added in 004
create policy files_select_own on public.files for select to authenticated
  using (uploaded_by = (select auth.uid()) or (select private.is_admin()));
create policy files_insert_own on public.files for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and scan_result is null and scanned_at is null);
create policy files_delete_own on public.files for delete to authenticated
  using (uploaded_by = (select auth.uid()));

create policy materials_select on public.materials for select to authenticated
  using (private.can_read_material(id));
create policy materials_write_owner on public.materials for all to authenticated
  using (private.is_class_owner(class_id))
  with check (private.is_class_owner(class_id) and owner_id = (select auth.uid()));
-- processing / error state is written by the pipeline (service role) only
revoke update on public.materials from authenticated;
grant update (title, deleted_at) on public.materials to authenticated;

create policy transcript_select on public.material_transcript_lines for select to authenticated
  using (private.can_read_material(material_id));
create policy summaries_select on public.material_summaries for select to authenticated
  using (private.can_read_material(material_id));
create policy objectives_select on public.material_objectives for select to authenticated
  using (private.can_read_material(material_id));
create policy objectives_write_owner on public.material_objectives for all to authenticated
  using (private.is_class_owner(private.material_class(material_id)))
  with check (private.is_class_owner(private.material_class(material_id)));
revoke insert, update, delete on public.material_transcript_lines, public.material_summaries
  from authenticated;

create policy views_select on public.material_views for select to authenticated
  using (student_id = (select auth.uid())
         or private.is_class_owner(private.material_class(material_id))
         or (select private.is_admin()));
create policy views_insert on public.material_views for insert to authenticated
  with check (student_id = (select auth.uid()) and private.can_read_material(material_id));
create policy views_update on public.material_views for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
revoke update on public.material_views from authenticated;
grant update (last_seen_at, watch_seconds, completed_at, view_count) on public.material_views to authenticated;

-- ---------------------------------------------------------------- derived: class progress
create view public.class_progress with (security_invoker = true) as
select e.class_id,
       e.student_id,
       count(m.id)                         as total_materials,
       count(v.completed_at)               as completed_materials,
       case when count(m.id) = 0 then 0
            else round(100.0 * count(v.completed_at) / count(m.id))::int end as progress_pct
from public.class_enrollments e
left join public.materials m
       on m.class_id = e.class_id and m.deleted_at is null and m.processing = 'ready'
left join public.material_views v
       on v.material_id = m.id and v.student_id = e.student_id
where e.left_at is null
group by e.class_id, e.student_id;
