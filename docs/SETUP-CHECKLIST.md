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
- [ ] Create `studia-prod` (YOU enter the DB password)
- [x] `supabase init` + `supabase link` to studia-dev
- [x] `supabase db push --remote` (6 migrations) and types in `shared-types/database.types.ts`
- [ ] Auth: enable Google provider (YOU paste Google client id/secret in dashboard)
- [ ] Auth: email OTP template and SMTP (YOU paste SMTP credentials in dashboard)
- [ ] Storage: confirm buckets `materials` and `submissions` exist (created by migration 003)
- [ ] Storage: free plan caps uploads at 50 MB; the 500 MB video cap needs Pro (decide)

## 4. Vercel projects
- [x] `studia-admin` project created (justineantipado10-9065/studia-admin), root dir `studia-admin`
- [x] `studia-api` project created, https://studia-api-mu.vercel.app
- [ ] Connect both to the git repo; production = `main`, previews = PRs
- [x] Test deploy: `GET /api/health` returns `{"ok":true}` (behind Vercel deployment protection)
- [ ] **YOU** add a GitHub Login Connection in Vercel account settings, then Claude runs `vercel git connect` in both projects (repo johnmarknatnat-wq/studia-mobile)
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
- [ ] Place the MariaDB dump at `supabase/seed/source/studia_db.sql` (Phase 1B)
- [ ] EAS: `eas init` / `eas update:configure` in `studia-mobile` (Phase later)
