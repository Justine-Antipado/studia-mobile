-- 005 planner, tasks, notifications, platform announcements.

create type public.task_kind           as enum ('assignment', 'quiz');
create type public.notification_kind   as enum ('notice','quiz','grade','lesson','class','ai','reminder','job','storage','security');
create type public.announcement_audience as enum ('all', 'students', 'instructors', 'course');
create type public.announcement_status as enum ('scheduled', 'published');

-- ---------------------------------------------------------------- tasks
-- Manual tick for an item that has no submission behind it. The task LIST is the view below.
create table public.student_task_overrides (
  id         text primary key default gen_random_uuid()::text,
  student_id uuid not null references public.users (id) on delete cascade,
  kind       public.task_kind not null,
  ref_id     text not null,
  done       boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (student_id, kind, ref_id)
);
create trigger trg_task_override_updated before update on public.student_task_overrides
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- planner
create table public.planner_weeks (
  id           text primary key default gen_random_uuid()::text,
  student_id   uuid not null references public.users (id) on delete cascade,
  week_start   date not null check (extract(isodow from week_start) = 1),  -- Monday
  generated_at timestamptz not null default now(),
  unique (student_id, week_start)
);

create table public.planner_blocks (
  id             text primary key default gen_random_uuid()::text,
  week_id        text not null references public.planner_weeks (id) on delete cascade,
  day_date       date not null,
  start_hour     smallint not null check (start_hour between 0 and 23),
  duration_hours smallint not null default 1 check (duration_hours between 1 and 24),
  title          text not null check (char_length(btrim(title)) between 1 and 140),
  task_kind      public.task_kind,
  task_ref_id    text,
  done           boolean not null default false,
  check (start_hour + duration_hours <= 24),
  check ((task_kind is null) = (task_ref_id is null))
);
create index ix_blocks_week on public.planner_blocks (week_id, day_date, start_hour);

create table public.planner_exams (
  id         text primary key default gen_random_uuid()::text,
  student_id uuid not null references public.users (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 140),
  exam_date  date not null,
  created_at timestamptz not null default now()
);
create index ix_exams_student on public.planner_exams (student_id, exam_date);

-- ---------------------------------------------------------------- notifications
create table public.notifications (
  id          text primary key default gen_random_uuid()::text,
  user_id     uuid not null references public.users (id) on delete cascade,
  kind        public.notification_kind not null,
  title       text not null check (char_length(title) between 1 and 140),
  body        text not null default '' check (char_length(body) <= 500),
  link_route  text check (char_length(link_route) <= 120),
  link_params jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index ix_notifications_user on public.notifications (user_id, read_at, created_at);

-- ---------------------------------------------------------------- platform announcements
create table public.platform_announcements (
  id           text primary key default gen_random_uuid()::text,
  author_id    uuid references public.users (id) on delete set null,
  title        text not null check (char_length(btrim(title)) between 1 and 140),
  body         text not null check (char_length(btrim(body)) between 1 and 4000),
  audience     public.announcement_audience not null default 'all',
  course       public.course_code,
  status       public.announcement_status not null default 'published',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  check ((audience = 'course') = (course is not null)),
  check (status <> 'scheduled' or scheduled_at is not null)
);
create index ix_platform_ann_status   on public.platform_announcements (status, scheduled_at);
create index ix_platform_ann_audience on public.platform_announcements (audience, course);

-- ---------------------------------------------------------------- derived: task list
create view public.student_tasks with (security_invoker = true) as
select e.student_id, 'assignment'::public.task_kind as kind, a.id as ref_id, a.class_id,
       a.title, a.due_at,
       (exists (select 1 from public.assignment_submissions s
                where s.assignment_id = a.id and s.student_id = e.student_id and s.status <> 'draft')
        or coalesce(o.done, false)) as done
from public.class_enrollments e
join public.assignments a on a.class_id = e.class_id and a.deleted_at is null
left join public.student_task_overrides o
       on o.student_id = e.student_id and o.kind = 'assignment' and o.ref_id = a.id
where e.left_at is null
union all
select e.student_id, 'quiz'::public.task_kind, q.id, q.class_id, q.title, q.due_at,
       (exists (select 1 from public.quiz_attempts t
                where t.quiz_id = q.id and t.student_id = e.student_id and t.submitted_at is not null)
        or coalesce(o.done, false))
from public.class_enrollments e
join public.quizzes q on q.class_id = e.class_id and q.status = 'published' and q.deleted_at is null
left join public.student_task_overrides o
       on o.student_id = e.student_id and o.kind = 'quiz' and o.ref_id = q.id
where e.left_at is null;

-- ---------------------------------------------------------------- RLS
alter table public.student_task_overrides  enable row level security;
alter table public.planner_weeks           enable row level security;
alter table public.planner_blocks          enable row level security;
alter table public.planner_exams           enable row level security;
alter table public.notifications           enable row level security;
alter table public.platform_announcements  enable row level security;

create policy task_override_own on public.student_task_overrides for all to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy planner_week_own on public.planner_weeks for all to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy planner_block_own on public.planner_blocks for all to authenticated
  using (exists (select 1 from public.planner_weeks w
                 where w.id = week_id and w.student_id = (select auth.uid())))
  with check (exists (select 1 from public.planner_weeks w
                      where w.id = week_id and w.student_id = (select auth.uid())));
create policy planner_exam_own on public.planner_exams for all to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));

-- notifications are created by the server; the owner may only mark them read or delete them
create policy notif_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notif_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notif_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create function private.user_course() returns public.course_code
language sql stable security definer set search_path = '' as $$
  select course from public.users where id = (select auth.uid())
$$;
create function private.user_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.users where id = (select auth.uid())
$$;
grant execute on function private.user_course(), private.user_role() to authenticated, service_role;

create policy platform_ann_select on public.platform_announcements for select to authenticated
  using (deleted_at is null and (
    (select private.is_admin())
    or (status = 'published' and (
          audience = 'all'
          or (audience = 'students'    and (select private.user_role()) = 'student')
          or (audience = 'instructors' and (select private.user_role()) = 'instructor')
          or (audience = 'course'      and course = (select private.user_course()))))));
revoke insert, update, delete on public.platform_announcements from authenticated;
