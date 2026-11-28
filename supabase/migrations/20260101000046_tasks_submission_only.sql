-- 046 tasks are checked by submission only: the student can no longer tick an assignment or quiz
-- by hand, so student_tasks.done ignores student_task_overrides (the table is kept, unused, so
-- nothing is dropped). Planner blocks that still carry a task_kind are legacy materialised rows;
-- the app now only reads the student's own plans (task_kind is null), so they are inert.
create or replace view public.student_tasks with (security_invoker = true) as
select e.student_id, 'assignment'::public.task_kind as kind, a.id as ref_id, a.class_id,
       a.title, a.due_at,
       exists (select 1 from public.assignment_submissions s
               where s.assignment_id = a.id and s.student_id = e.student_id and s.status <> 'draft') as done
from public.class_enrollments e
join public.assignments a on a.class_id = e.class_id and a.deleted_at is null
where e.left_at is null
union all
select e.student_id, 'quiz'::public.task_kind, q.id, q.class_id, q.title, q.due_at,
       exists (select 1 from public.quiz_attempts t
               where t.quiz_id = q.id and t.student_id = e.student_id and t.submitted_at is not null)
from public.class_enrollments e
join public.quizzes q on q.class_id = e.class_id and q.status = 'published' and q.deleted_at is null
where e.left_at is null;
