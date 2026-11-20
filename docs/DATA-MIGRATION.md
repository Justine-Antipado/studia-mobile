# Data migration: MariaDB dump -> CSV -> Supabase

Source of truth: `supabase/seed/source/studia_db.sql` (seed data only). CSVs in `supabase/seed/csv/` are build
artifacts (gitignored). The scripts live in `scripts/` and read column types from `supabase/migrations/`.

## Run it
1. One time, create `.env.dev` in the repo root (gitignored; never commit, never paste in chat):
   `SUPABASE_URL=https://chvibqjstucybirsmpwu.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY=...`,
   `SUPABASE_DB_URL=...` (Dashboard > Connect > **Session pooler** string; the direct host is IPv6-only).
2. `cd scripts && npm install && npm run db:seed:dev` = convert, import with `--reset`, verify. All green or exit 1.
3. Pieces: `npm run convert`, `npm run import:dev` (no reset; fails if rows already exist), `npm run verify:dev`, `npm test`.
4. Prod: `.env.prod`, then `npm run db:seed:prod`. It imports ONLY the admin user and settings, never `--reset`,
   and refuses to run without `--confirm`. A key or DB URL for the other project is rejected.

## What the import does
- Creates one Auth user per `users` row (random password, printed once, never stored). Old id -> new uuid goes to
  `csv/_id_map.csv` (reused on re-runs), then every column that references `users` is rewritten into `csv/_mapped/`.
- Legacy `@omsc.edu.ph` demo accounts become `@omsu.edu.ph` (flagged `app_metadata.demo`). The
  `pending_approval` instructor gets an unconfirmed, banned Auth user.
- All other ids (`it321`, `l1`, `quiz_it321_2`...) are unchanged. One transaction; `users` and `settings` are upserted.

## Intentionally skipped or changed
- Tables: `otp_codes`, `auth_tokens`, `sessions` (Auth owns them; seed sessions held placeholder hashes).
- Columns: `users.password_hash`, `users.email_verified_at` (Auth), `class_enrollments.progress_pct` (derived by view
  `class_progress`; verify compares it to the dump's cached value), `files.stored_name` -> `object_path` + `bucket`.
- `quiz_questions` feeds two tables: `quiz_questions` and `quiz_question_keys` (answer key, RLS-protected).
- Seed file metadata is not backed by real objects in Storage; downloads of seeded files will 404.

## Add a table
1. Add the table to a migration. 2. Add a `{ csv, src, dest, drop/keep/rename, transform }` entry to `PLAN` in
`scripts/src/lib/plan.ts` at its FK position (renumber the `csv` prefix). 3. `npm run convert`: it fails loudly for any
source column without a destination, unknown enum value, bad JSON/date/boolean, or unlisted source table.
