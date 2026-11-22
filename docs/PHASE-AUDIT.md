# Phase 1–3 completeness audit (2026-11-20)

Audit only, except the two Auth fixes at the bottom. Verified from the repo; items needing your dashboards are marked **YOU**.

## 1. Is the app connected to the DB? (short answer: auth only, and only if the build sets `remote`)

| Area | State |
|---|---|
| Mobile auth (login, register, OTP, Google, reset) | `RemoteAuthService` exists → Supabase Auth + `studia-api`. Used **only** when `EXPO_PUBLIC_DATA_SOURCE=remote` |
| Mobile build config | `eas.json` sets only the Google client ids. It does **not** set `EXPO_PUBLIC_DATA_SOURCE`, `_SUPABASE_URL`, `_SUPABASE_ANON_KEY`, `_API_URL`. Unless set via `eas env`, every build defaults to **mock** and never reaches the DB (**YOU**: confirm with `eas env:list`) |
| Mobile feature data (classes, lessons, quizzes, tasks, planner, announcements, assignments, notifications, analytics, students, submissions) | **No `Remote*Repository` exists.** All 17 repositories are mock-only, even with `remote` on |
| Admin | Only `login`/`logout` go to Supabase (`core/data/remote/remoteAuth.js`). `getDashboard`, `getUsers`, settings, nav counts etc. still use `mockBackend` or the old PHP `httpBackend`. **Admin is not connected to the DB for data.** `studia-admin/.env.example` still documents the PHP API |
| DB itself | studia-dev has schema + 257 seeded rows + 16 auth users (VERIFY OK per checklist) |

## 2. What is missing, per phase

**Phase 1 (infra + schema)**
- `studia-prod`: migrations not pushed yet (**YOU**: link prod, `supabase db push --remote`). Prod Vercel env points to an empty DB.
- Storage buckets `materials` / `submissions` not confirmed (**YOU**, dashboard).
- Material cap is 50 MB in DB (migration 012, the free-plan maximum) and in the mobile validator/UI copy. Migrations 011-013 are written but NOT pushed or run anywhere yet.
- `supabase db reset` (local) never run: Docker not installed. The exit criterion was only met via `db push --remote`.
- Dev seed passwords were printed in chat: rotate (**YOU**).
- `eas init` / `eas update:configure` not done (needed for EAS Update OTA).
- Stray `src.zip`, `src (2).zip`, `src (3).zip` committed in `studia-mobile/` and `src-admin.zip` in `studia-admin/`.

**Phase 1B (CSV import)**: scripts, verify and docs are present. Gap: `supabase/seed/csv/` is empty in git (by design, build artifact), prod import path untested until prod has schema.

**Phase 2 (RLS)**: migration 008 + `supabase/tests/rls` (321-line case list) exist. Not confirmed: the tests were run against the current DB after migration 009; pgTAP not used (custom runner); correct_index/rationale hiding for students needs one more review pass after Phase 4 adds the quiz repository.

**Phase 3 (auth)** still open per `AUTH-SETUP.md`/checklist:
- Google provider enabled in Supabase dashboard (**YOU**).
- Email OTP template + SMTP in Supabase (**YOU**). No domain available, so use Gmail SMTP with an app password (already the documented path) and accept the ~500/day Gmail send cap.
- Android Google client + SHA-1 from the EAS keystore (**YOU**: `eas credentials`).
- Dev build required for Google (not Expo Go).
- Email policy: server already accepts `@gmail.com` **and** `@omsu.edu.ph` (`studia-api/src/lib/policy.ts`, migration 009, trigger). Seeded demo users use `@omsu.edu.ph`; keep the second domain so they can still log in. To make it Gmail-only, change those three places and rename the seeded users.
- Admin Google/web OAuth not done; admin password login only.

**Not in Phases 1–3 but in your master prompt (still 0%)**: `Remote*Repository` for every feature, TanStack Query + persisted cache, offline mutation queue with Idempotency-Keys, AI endpoints (summarizer, planner, chat, quiz synthesizer) in `studia-api`, file upload flow, admin data. `@tanstack/react-query` is not installed.

## 3. APK size (audit only)

Likely causes, biggest first:
1. **Image assets ≈ 4 MB uncompressed**: `studia-mascot.png` 2.0 MB, `studia-mobile-logo.png` 1.06 MB (also used as app icon), `omsc.logo.png` 0.99 MB. Convert to WebP / resize to display size → ~3.5 MB saved.
2. **All CPU architectures** in internal/preview APKs (arm64-v8a, armeabi-v7a, x86, x86_64 ≈ 4× native libs, Hermes, Reanimated). Production AAB is split per device by Play. For a sideload APK, enable arm64 only (`expo-build-properties`: `android.buildArchs`).
3. **`expo-dev-client`** is a dependency, so even `preview` builds ship the dev launcher/menu. Remove from `preview`/`production` profiles (use a dev-only profile with it).
4. **Declared but never imported in `src/`** (candidates to remove after confirming Expo Router doesn't need them): `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-device`, `expo-web-browser`, `expo-linking` (router brings its own), `expo-system-ui`, `react-native-gesture-handler`, `@react-navigation/bottom-tabs` (router provides it). `@expo/ui` and `expo-glass-effect` carry native code.
5. `@expo/vector-icons` bundles every icon font family (Ionicons only is used): ~1–2 MB of fonts. Could be trimmed with a font subset.
6. Android `minify`/`shrinkResources` are off by default: enable via `expo-build-properties` (`enableProguardInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`).
7. The zips above are not bundled in the APK but bloat the repo/EAS upload.

Expected effect of 1+2+3+6: roughly 40–60% smaller. Needs `eas build --profile preview --platform android` to measure; I did not build.

## 4. Changes made in this pass (Auth only)

- **Dropdown not selectable (course/year/section/department)**: `DropdownHost` was rendered inside the `ScrollView`, whose `onTouchStart={closeAllDropdowns}` fires for touches on the menu rows and closes the menu before the row's `onPress`. Moved `<DropdownHost />` out of the ScrollView (last child of the root `View`, as its own comment prescribes).
- **Google button made the submit buttons show "Please wait…"**: one shared `busy` flag. Added `googleBusy`; only the Google button shows "Connecting to Google…", form buttons keep their label (they are still disabled to prevent double taps).
- **Slow sign-in**: `studia-api` had no region, so Vercel ran it in `iad1` (US East) while Supabase is in Singapore, and each login makes ~6 sequential DB round trips. Set `regions: ["sin1"]` in `studia-api/vercel.json` and ran the three post-login writes in parallel. Cold start (~1–2 s on free tier) remains.
- Verified: `tsc --noEmit` clean in `studia-mobile` and `studia-api`, `expo lint src/features/auth` clean. Not tested on a device.
