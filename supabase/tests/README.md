# RLS tests

```bash
cd supabase/tests && npm install && npm test          # all migrations
node rls/run.mjs --upto 7                               # state before the Phase 2 hardening (shows what it fixed)
```

Runs the real `supabase/migrations/*.sql` on PGlite (Postgres compiled to WASM, no Docker/CLI needed).
`rls/stubs.sql` fakes only what Supabase provides (roles, `auth.users`, `auth.uid()`, `storage.*`).
Every case runs as one persona inside a rolled-back transaction with `set local role` + a JWT `sub`.

- Personas: student (enrolled), student (no class), instructor (owner), instructor (other class), admin, anon.
- Matrix: every public table x select/insert/update/delete, plus privilege-escalation probes
  (self-promotion, forged owners, foreign file ids, early answer keys, pipeline-only columns).
- Structural checks: RLS on every table, a test case for every table (a new table fails the run until covered),
  anon holds no privileges, no `storage.objects` client policies, no admin short-cut left in any policy.
- `0` in an expectation means "blocked" (0 rows or 42501); `D` means it must be refused with 42501.

## Rules this enforces on the data layer (Phase 3)

- **Admin never reads tables directly.** The dashboard calls `studia-api`, which uses the service role.
- `public.users`: list columns explicitly. `select *` fails by design (`failed_login_count`, `locked_until`, `deleted_at` are server-only).
  Same for `public.sessions` (`token_hash`).
- Delete a class with `rpc('delete_class')`, not `update ... set deleted_at`.
- Turn-in, grading, attempt submit/score, OTP, notifications, AI logs, settings writes: server (service role) only.
- Answer keys (`quiz_question_keys`) are readable by a student only after they submitted and have no attempts left (or the quiz is past due).
- `file_id` on materials / attachments / submissions must be a file the caller registered.

Not covered (needs a real Supabase stack): Storage bucket behaviour, PostgREST/GoTrue, and the
Postgres major version difference. Run once against the CLI stack (`supabase db reset`) before go-live.
