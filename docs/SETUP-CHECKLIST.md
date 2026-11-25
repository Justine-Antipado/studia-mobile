# Setup checklist (Supabase + Vercel + EAS)

Legend: `[x]` done, `[ ]` still to do. **YOU** = manual step (login, secret, billing).

## 1. Tooling
- [x] node 24, npm, git
- [x] `vercel` 66.5, `eas-cli` 27.11
- [x] `supabase` CLI 3.2.0 (Scoop). NOTE: v3 targets the local Docker stack by default, always pass `--remote`
- [ ] Docker Desktop (optional; only for local `supabase start` / local `db reset`)

## 2. Logins (YOU, one at a time)
- [x] `supabase login`, `vercel login` (justineantipado10-9065), `eas login` (justineantipado)

## 3. Supabase projects (region: Singapore `ap-southeast-1` unless changed)
- [x] Organization `imsgvpobrjnbcgdlkjyf`, region Singapore
- [x] `studia-dev` = chvibqjstucybirsmpwu (old Tokyo project deleted)
- [x] ~~`studia-prod` = xvjahswctcarvblxgjmd (Singapore). Production Vercel env vars point to it~~
      **ABANDONED 2026-11-26.** There is no production project: `studia-dev`
      (chvibqjstucybirsmpwu) is the only database, and it is what launches. Every config already
      points at it — all three `eas.json` profiles including `production`, the CSP `connect-src`
      in `studia-admin/vercel.json`, and the deployed admin bundle (verified). The claim that
      "production Vercel env vars point to it" was never true of the admin site and is struck.
      **Still to confirm by hand:** Vercel -> `studia-api` -> Environment Variables ->
      `SUPABASE_URL` must read `https://chvibqjstucybirsmpwu.supabase.co`.
- [x] ~~**YOU** `supabase link --project-ref xvjahswctcarvblxgjmd` then `supabase db push --remote`, then re-link to dev~~ — struck, see above. Do not push to studia-prod.
- [x] `supabase init` + `supabase link` to studia-dev
- [x] `supabase db push --remote` (6 migrations) and types in `shared-types/database.types.ts`
- [ ] Auth: apply migration 010 (Gmail-only) with `supabase db push --remote`, then enable Google provider: see docs/AUTH-SETUP.md (Phase 3)
- [ ] Auth: email OTP template and SMTP (Resend + DNS): see docs/AUTH-SETUP.md (Phase 3)
- [ ] Storage: confirm buckets `materials` and `submissions` exist (created by migration 003)
- [x] Storage: material cap is 50 MB (migration 012; 007 had set 40 MB). Mobile validator and UI copy now say 50 MB.
- [ ] Push migrations 011 (assessment schedule + rules), 012 (50 MB cap), 013 (`profile_update` OTP purpose): `supabase db push --remote`, then re-run the RLS tests in `supabase/tests`

## 4. Vercel projects
- [x] `studia-admin` project created (justineantipado10-9065/studia-admin), root dir `studia-admin`
- [x] `studia-api` project created, https://studia-api-mu.vercel.app
- [ ] Connect both to the git repo; production = `main`, previews = PRs
- [x] Test deploy: `GET /api/health` returns `{"ok":true}` (behind Vercel deployment protection)
- [x] Repo transferred to Justine-Antipado/studia-mobile (origin updated); Vercel GitHub App installed; both projects connected; root dirs set (studia-api, studia-admin). Production = main, previews = PRs
- [x] Public env vars set for Development + Preview (SUPABASE_URL, SUPABASE_ANON_KEY, VITE_*). Production values wait for studia-prod

## 5. Environment variables (per environment: Development / Preview / Production)

| Variable | Where it goes | Who sets it |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DATA_SOURCE`, `VITE_API_URL` | Vercel `studia-admin` | Claude via CLI (public values) |
| `SUPABASE_URL` | Vercel `studia-api` | Claude via CLI (public value) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel `studia-api` only | **YOU** |
| `AI_API_KEY` | Vercel `studia-api` only | **YOU** |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Vercel `studia-api` + Supabase Auth SMTP | **YOU** |
| `GOOGLE_CLIENT_ID_WEB/ANDROID/IOS` | Vercel `studia-api`, EAS env, Supabase Auth | **YOU** |
| `SUPABASE_DB_URL` | local `.env` for `scripts/` only | **YOU** |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_DATA_SOURCE` | EAS env (`eas env:create`) | Claude via CLI (public values) |

The service-role key and AI keys must never appear in `studia-mobile`, `studia-admin` or git.

## 6. Repo
- [x] `supabase/migrations/` (6 files), `supabase/seed.sql` (settings defaults only)
- [x] `supabase/seed/source/`, `supabase/seed/csv/`, `scripts/`, `studia-api/`
- [x] Root `.env.example`, `.gitignore` (secrets, csv artifacts)
- [x] MariaDB dump at `supabase/seed/source/studia_db.sql` (copied from backend/database/studia.db.sql)
- [x] Phase 1B scripts in `scripts/` (converter runs, 29 CSVs; tokenizer tests pass). See docs/DATA-MIGRATION.md
- [x] `.env.dev` created; `npm run db:seed:dev` ran on studia-dev: 257 rows, 16 auth users, VERIFY OK
- [ ] **YOU** rotate the dev seed passwords (they were printed in chat). For prod, run `npm run db:seed:prod` only after studia-prod has its schema
- [ ] EAS: `eas init` / `eas update:configure` in `studia-mobile` (Phase later)
