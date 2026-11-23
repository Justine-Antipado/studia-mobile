-- 022 campus announcements: the admin broadcasts a notice to everyone (or one audience) and it lands
-- in each user's Alerts tab. Replaces the old platform_announcements (dropped in 021, never read by
-- the app): the table now only stores what the admin sent; delivery is a plain `notifications` row per
-- recipient, so the mobile app, Realtime and push (migration 019) work without any new client code.
--
-- Immediate publish only (no scheduling). The body is capped at 500 chars, the size of a notification.

create type public.announcement_audience as enum ('all', 'students', 'instructors', 'course');

create table public.platform_announcements (
  id         text primary key default gen_random_uuid()::text,
  author_id  uuid references public.users (id) on delete set null,
  title      text not null check (char_length(btrim(title)) between 1 and 140),
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  audience   public.announcement_audience not null default 'all',
  course     public.course_code,
  recipients integer not null default 0,
  created_at timestamptz not null default now(),
  check ((audience = 'course') = (course is not null))
);
create index ix_platform_ann_created on public.platform_announcements (created_at desc);

-- Only the admin touches this table, with their own session. Everyone else receives notifications.
alter table public.platform_announcements enable row level security;
revoke all on public.platform_announcements from anon, authenticated;
grant select, insert, delete on public.platform_announcements to authenticated;
create policy platform_ann_admin on public.platform_announcements for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------- fan-out
create function private.trg_platform_announcement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_users uuid[]; v_actor text;
begin
  select coalesce(array_agg(u.id), '{}') into v_users
  from public.users u
  where u.status = 'active' and u.deleted_at is null and u.role in ('student', 'instructor')
    and case new.audience
          when 'all'         then true
          when 'students'    then u.role = 'student'
          when 'instructors' then u.role = 'instructor'
          else u.role = 'student' and u.course = new.course
        end;

  perform private.notify_users(v_users, 'notice', new.title, 'Campus announcement', new.body);

  update public.platform_announcements set recipients = coalesce(array_length(v_users, 1), 0) where id = new.id;
  select coalesce(full_name, 'Administrator') into v_actor from public.users where id = new.author_id;
  insert into public.audit_log (actor_id, actor_name, action, summary, target_type, target_ids)
  values (new.author_id, coalesce(v_actor, 'Administrator'), 'create',
          left('Published campus announcement "' || new.title || '".', 255),
          'platform_announcement', jsonb_build_array(new.id));
  return null;
end $$;

create trigger trg_platform_announcement after insert on public.platform_announcements
  for each row execute function private.trg_platform_announcement();
