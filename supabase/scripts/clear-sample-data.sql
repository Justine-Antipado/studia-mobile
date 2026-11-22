-- clear-sample-data.sql: ONE-OFF cleanup. Removes the sample data that came from supabase/seed/csv
-- (Juan Dela Cruz, Maria Santos, the sample classes, materials, quizzes, grades, notifications...)
-- so the database only holds real data.
--
-- How sample rows are told apart from real ones: every seeded account uses an @omsu.edu.ph address,
-- while real sign-ups are Gmail-only (migration 010). So:
--   * KEPT:    admin@omsu.edu.ph (the fixed admin) and every @gmail.com account + everything they made.
--   * REMOVED: every other @omsu.edu.ph account, the classes they teach (and, by cascade, those
--              classes' enrollments, materials, assignments, quizzes, attempts, announcements...),
--              and their notifications / AI history.
--
-- Run it once in the Supabase SQL editor (or `psql`). It is a single transaction: if anything
-- fails, nothing is deleted. Files already uploaded to Storage for sample materials are not
-- touched here; delete the leftover objects from the Storage page if you want the space back.
--
-- Look before you delete: run the SELECT below first and check the list.
--   select id, email, role from public.users where email like '%@omsu.edu.ph' and email <> 'admin@omsu.edu.ph';

begin;

create temp table sample_users on commit drop as
  select id from public.users
  where email like '%@omsu.edu.ph' and email <> 'admin@omsu.edu.ph';

-- classes.instructor_id is ON DELETE RESTRICT, so the sample classes have to go first.
delete from public.classes where instructor_id in (select id from sample_users);

-- Sample students' rows in real classes (enrollments, submissions, attempts, ...) cascade with the user.
delete from auth.users where id in (select id from sample_users);

-- Seeded system-wide rows that are not tied to a user (platform announcements, demo notifications).
delete from public.notifications where user_id is null;

commit;
