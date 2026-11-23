-- 021 admin <-> mobile sync. Removes what the admin portal no longer shows and the mobile app
-- never used. NOT applied automatically: review, then `supabase db push` (dev first).
--
-- Admin pages removed: Settings > Academic term, Settings > Uploads, Security > Vulnerabilities,
-- and the system-wide announcement composer (the Announcements page now moderates the class
-- streams, i.e. public.announcements + announcement_comments, exactly what the mobile course
-- screen shows).
--
-- Data this destroys (dev project at the time of writing): 1 platform_announcements row,
-- 2 settings rows (term, uploads), classes.school_year/semester values. security_findings is empty.

-- 1. Vulnerabilities page: nothing wrote to it (no scanner), nothing reads it any more.
drop table if exists public.security_findings;
drop type  if exists public.severity_level;

-- 2. System-wide announcements: mobile never read them (class stream only).
drop table if exists public.platform_announcements;
drop type  if exists public.announcement_audience;
drop type  if exists public.announcement_status;

-- 3. Academic term + upload limits: admin pages are gone and the mobile app never read these rows.
--    (Upload size limits stay enforced by the storage bucket cap and migration 012.)
delete from public.settings where section in ('term', 'uploads');
-- NOTE: the enum values 'term' and 'uploads' stay in public.settings_section; Postgres cannot drop
-- an enum value without rebuilding the type, and an unused label is harmless.

-- 4. Semester / school year: the mobile "create class" form never sent them, so they are always null.
alter table public.classes drop column if exists school_year;
alter table public.classes drop column if exists semester;
