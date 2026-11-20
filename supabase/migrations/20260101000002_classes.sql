-- 002 classes: classes, enrolments, class announcements and comments.
-- progress and student counts are NOT stored (see views in 003).

create function private.gen_join_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6)
$$;

create table public.classes (
  id            text primary key default gen_random_uuid()::text,
  subject_code  text not null check (char_length(btrim(subject_code)) between 1 and 20),
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  instructor_id uuid not null references public.users (id) on delete restrict,
  course        public.course_code not null,
  year_level    public.year_level not null,
  section       public.section_code not null,
  join_code     text not null default private.gen_join_code() check (join_code ~ '^[A-Z0-9]{6}$'),
  school_year   text,
  semester      text,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create unique index uq_classes_join_code on public.classes (join_code);
create index ix_classes_instructor on public.classes (instructor_id, archived);
create index ix_classes_cys        on public.classes (course, year_level, section);
create trigger trg_classes_updated before update on public.classes
  for each row execute function public.set_updated_at();

create table public.class_enrollments (
  id         text primary key default gen_random_uuid()::text,
  class_id   text not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.users (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  unique (class_id, student_id)
);
create index ix_enrollment_student on public.class_enrollments (student_id, left_at);

-- ---------------------------------------------------------------- access helpers (security definer: no RLS recursion)
create function private.is_class_owner(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classes
                 where id = cid and instructor_id = (select auth.uid()) and deleted_at is null)
$$;
create function private.is_class_member(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_enrollments e
                 join public.classes c on c.id = e.class_id and c.deleted_at is null
                 where e.class_id = cid and e.student_id = (select auth.uid()) and e.left_at is null)
$$;
create function private.can_access_class(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_class_owner(cid) or private.is_class_member(cid) or private.is_admin()
$$;
grant execute on function private.is_class_owner(text), private.is_class_member(text),
  private.can_access_class(text) to authenticated, service_role;

-- ---------------------------------------------------------------- RLS: classes / enrolments
alter table public.classes           enable row level security;
alter table public.class_enrollments enable row level security;

create policy classes_select on public.classes for select to authenticated
  using (deleted_at is null and private.can_access_class(id));
create policy classes_insert on public.classes for insert to authenticated
  with check (instructor_id = (select auth.uid())
              and exists (select 1 from public.users u
                          where u.id = (select auth.uid()) and u.role = 'instructor' and u.status = 'active'));
create policy classes_update on public.classes for update to authenticated
  using (instructor_id = (select auth.uid())) with check (instructor_id = (select auth.uid()));
create policy classes_delete on public.classes for delete to authenticated
  using (instructor_id = (select auth.uid()));
-- instructor_id and join_code can not be reassigned by a client
revoke update on public.classes from authenticated;
grant update (subject_code, title, course, year_level, section, school_year, semester, archived, deleted_at)
  on public.classes to authenticated;

create policy enroll_select on public.class_enrollments for select to authenticated
  using (student_id = (select auth.uid()) or private.is_class_owner(class_id) or (select private.is_admin()));
-- instructor "remove student" = set left_at
create policy enroll_update_owner on public.class_enrollments for update to authenticated
  using (private.is_class_owner(class_id)) with check (private.is_class_owner(class_id));
revoke insert, delete, update on public.class_enrollments from authenticated;
grant update (left_at) on public.class_enrollments to authenticated;

-- A student can not list classes, so joining goes through a code lookup.
create function public.join_class(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare cid text;
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'student' and status = 'active') then
    raise exception 'only active students can join a class' using errcode = '42501';
  end if;
  select id into cid from public.classes
   where join_code = upper(btrim(p_code)) and deleted_at is null and not archived;
  if cid is null then raise exception 'invalid join code' using errcode = 'P0002'; end if;
  insert into public.class_enrollments (class_id, student_id) values (cid, auth.uid())
  on conflict (class_id, student_id) do update set left_at = null, joined_at = now()
  where public.class_enrollments.left_at is not null;
  return cid;
end $$;

create function public.leave_class(p_class_id text) returns void
language sql security definer set search_path = '' as $$
  update public.class_enrollments set left_at = now()
  where class_id = p_class_id and student_id = auth.uid() and left_at is null
$$;
revoke execute on function public.join_class(text), public.leave_class(text) from public, anon;
grant execute on function public.join_class(text), public.leave_class(text) to authenticated;

-- instructors may read the profiles of students enrolled in their classes
create policy users_select_roster on public.users for select to authenticated
  using (exists (select 1 from public.class_enrollments e
                 where e.student_id = users.id and private.is_class_owner(e.class_id)));
-- students may read the instructor of a class they are in (display name)
create policy users_select_teacher on public.users for select to authenticated
  using (exists (select 1 from public.classes c
                 where c.instructor_id = users.id and private.is_class_member(c.id)));

-- ---------------------------------------------------------------- class announcements
create table public.announcements (
  id         text primary key default gen_random_uuid()::text,
  class_id   text not null references public.classes (id) on delete cascade,
  author_id  uuid references public.users (id) on delete set null,
  title      text not null check (char_length(btrim(title)) between 1 and 100),
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  pinned     boolean not null default false,
  posted_at  timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index ix_announcements_class on public.announcements (class_id, pinned, posted_at);
create trigger trg_announcements_updated before update on public.announcements
  for each row execute function public.set_updated_at();

create table public.announcement_comments (
  id              text primary key default gen_random_uuid()::text,
  announcement_id text not null references public.announcements (id) on delete cascade,
  author_id       uuid references public.users (id) on delete set null,
  body            text not null check (char_length(btrim(body)) between 1 and 500),
  posted_at       timestamptz not null default now(),
  deleted_at      timestamptz,
  deleted_by      uuid references public.users (id) on delete set null
);
create index ix_comments_announcement on public.announcement_comments (announcement_id, posted_at);

create function private.announcement_class(aid text) returns text
language sql stable security definer set search_path = '' as $$
  select class_id from public.announcements where id = aid
$$;
grant execute on function private.announcement_class(text) to authenticated, service_role;

alter table public.announcements         enable row level security;
alter table public.announcement_comments enable row level security;

create policy ann_select on public.announcements for select to authenticated
  using (deleted_at is null and private.can_access_class(class_id));
create policy ann_write on public.announcements for all to authenticated
  using (private.is_class_owner(class_id))
  with check (private.is_class_owner(class_id) and author_id = (select auth.uid()));

create policy cmt_select on public.announcement_comments for select to authenticated
  using (deleted_at is null and private.can_access_class(private.announcement_class(announcement_id)));
create policy cmt_insert on public.announcement_comments for insert to authenticated
  with check (author_id = (select auth.uid())
              and (private.is_class_member(private.announcement_class(announcement_id))
                   or private.is_class_owner(private.announcement_class(announcement_id))));
-- author or the class instructor may remove a comment
create policy cmt_delete on public.announcement_comments for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_class_owner(private.announcement_class(announcement_id)));
