-- 044 planner priority + notes: a manual plan the student adds now carries their own notes and a
-- priority (high/medium/low) set in the Add Plan form. A task-derived block is still computed from
-- student_tasks at read time and never stored, so it has no row here to carry these columns.

create type public.planner_priority as enum ('high', 'medium', 'low');

alter table public.planner_blocks
  add column notes    text not null default '' check (char_length(notes) <= 500),
  add column priority public.planner_priority not null default 'medium';
