# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

<<<<<<< HEAD
Monorepo for **Studia**, a learning platform for OMSC/OMSU with three roles: student, instructor, and a single fixed admin. Each sub-project has its own `package.json`; there is no root workspace, so run commands from inside the sub-project directory.

| Directory | What it is | Stack |
|---|---|---|
| `studia-mobile/` | Student + instructor app | Expo SDK 58, Expo Router, React Native 0.88, TypeScript (strict) |
| `studia-admin/` | Admin web dashboard | Vite + React 19, React Router 7, plain JSX |
| `backend/` | Planned PHP REST API | **Skeleton only**: folders contain placeholder READMEs, `index.php` is empty, SQL migrations are documentation and are not executed |
| `docs/` | `api-contract.md` (endpoint map), `database.md`, `architecture.md` | |

There are no tests in any sub-project yet.
=======
Studia is a learning-management system for OMSU with three independent sub-projects (no root package.json / workspace tooling — run commands inside each folder):

- `studia-mobile/` — Expo (SDK 58) + React Native + TypeScript app for **students and instructors**.
- `studia-admin/` — React 19 + Vite + JavaScript (JSX) web dashboard for the single **admin** account.
- `backend/` — PHP backend. Currently **scaffolding only**: `index.php` is empty and module folders contain placeholder READMEs. The SQL files in `database/migrations/` are copied from the documented schema in the mobile auth service and are not executed or wired to anything.
- `docs/` — `api-contract.md` holds the auth endpoint map/contract (copied from `studia-mobile/src/features/auth/data/auth-service.ts`); other docs are stubs.
>>>>>>> e324ff9ee7df44118d722a6dc9081989d51a1e3d

## Commands

### studia-mobile
```bash
<<<<<<< HEAD
npx expo start              # dev server (npm start)
npx expo lint               # ESLint (eslint-config-expo)
npx tsc --noEmit            # typecheck
npx expo install <package>  # ALWAYS use instead of npm install for deps — picks SDK-compatible versions
npx expo-doctor             # diagnose dependency/config problems
```
Run lint and typecheck before declaring a mobile task done.

### studia-admin
```bash
npm run dev      # Vite dev server
npm run build    # production build
npm run lint     # oxlint
```

## Key point: everything runs on in-memory mocks

No client talks to a real server yet. Both apps are structured so the mock layer can be swapped for HTTP calls without touching UI code:

- **Mobile auth**: `studia-mobile/src/features/auth/data/auth-service.ts` is a full mock auth server (login, register, OTP verify/resend, Google sign-in, password reset, rate limiting, lockouts, typed `AuthError` codes). Its header/comments are the de facto API spec and DB schema; `docs/api-contract.md` and `backend/database/migrations/*.sql` were copied from it. Seed logins: `student@omsc.edu.ph` / `Student@123`, `instructor@omsc.edu.ph` / `Instructor@123`. In `__DEV__`, OTP responses include `devCode`.
- **Mobile content data**: `src/core/data/mock/mock-data.ts` (classes, courses, etc.), to be replaced with API calls.
- **Mobile session**: `src/core/data/storage/session-store.ts` is a tiny `useSyncExternalStore` store (`setUser`, `useUser`). `useRoleUser(role)` falls back to a demo user in `__DEV__` so role screens can be opened directly after a hot reload without logging in.
- **Admin**: `studia-admin/src/core/data/api.js` is the *only* module UI code may call; each function currently delegates to `core/data/mock/mockBackend.js`. The admin account is hard-coded there (`admin` / `Studia@2026`); there is intentionally no register route.
- Env vars for the future API: `EXPO_PUBLIC_API_URL` (mobile), `VITE_API_URL` (admin), `DB_*` (backend).

When changing auth behavior or data shapes, keep the mock, `docs/api-contract.md`, and the migrations consistent.

## Mobile architecture (`studia-mobile/src`)

- `app/` — Expo Router routes only. Route files are one-line re-exports (`export { default } from "@/features/student/screens/home-screen"`); put real screen code in `features/`, never in `app/`.
  - Root `_layout.tsx`: loads Poppins fonts, holds the splash screen, defines a header-less `Stack`.
  - Flow: `index` (welcome) → `explore` (role choice) → `auth?role=…` → `student/*` or `instructor/*`.
  - `student/_layout.tsx` and `instructor/_layout.tsx` are `Tabs` navigators using the custom `StudiaTabBar` (`shared/components/ui/studia-tab-bar.tsx`). Detail screens (`course-detail`, `class-detail`) are registered with `href: null` and mapped to their parent tab via the tab item's `also` array.
- `features/<name>/` — feature modules (`auth`, `onboarding`, `student`, `instructor`, `shared-screens`), each with `screens/ components/ data/ logic/ hooks/ types/` and an `index.ts`. Many of those subfolders contain only a placeholder README.
- `core/` — cross-feature infrastructure: `types/role.ts` (`"student" | "instructor"`), `data/` (mock, storage, future api-client), `config/`, `logic/`.
- `shared/` — reusable UI (`Screen`, `AppHeader`, `AppButton`, `parts.tsx`), colors in `shared/constants/studia-colors.ts` (imported as `C`), hooks, utils.
- Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.

## Admin architecture (`studia-admin/src`)

Same feature-based layout: `features/{auth,dashboard,users,settings}/` with `pages/`, `components/`, etc. `App.jsx` wraps all routes except `/login` in `ProtectedRoute` (backed by `features/auth/context/AuthContext.jsx`) plus the shared `Layout`. Shared UI primitives live in `shared/components/ui.jsx`; theme tokens in `src/theme.js`.

## Backend conventions (planned)

`backend/src/Core/{Database,Http,Middleware,Security,Support}` for infrastructure and `backend/src/Modules/{Auth,Student,Instructor,Admin}/{Controllers,Services,Repositories,Models,Validators}` per domain. Target DB is MySQL (see `001_create_users.sql`). Security notes in `auth-service.ts` comments (hash passwords server-side with argon2id/bcrypt, store only hashed OTPs, verify Google ID tokens server-side, no account enumeration) are requirements for the real implementation.

## Expo-specific rules (from `studia-mobile/AGENTS.md`)

- Expo changes a lot between SDK releases, so don't rely on memory for APIs. Check the `expo` major version in `package.json` and consult `https://docs.expo.dev/versions/v<major>.0.0/` or `https://docs.expo.dev/llms.txt`.
- `ios/` and `android/` are generated (Continuous Native Generation). Never create or edit them by hand; configure native behavior through `app.json` and config plugins.
- Libraries with native code need a development build (`npx expo run:ios|android` or `eas build --profile development`), not Expo Go.
- Prefer official Expo modules over third-party libraries. Use EAS (`npx eas-cli@latest …`) for builds, submission, and OTA updates.
=======
npm install
npx expo start              # dev server (npm start)
npx expo lint               # lint (npm run lint)
npx tsc --noEmit            # typecheck
npx expo install <package>  # ALWAYS use instead of npm install for deps — picks SDK-compatible versions
npx expo-doctor             # diagnose dependency/config issues
```
Run lint and typecheck before declaring a task done. There is no test runner configured.

### studia-admin
```bash
npm install
npm run dev       # Vite dev server
npm run build
npm run lint      # oxlint
```
No test runner configured.

### Environment
- Mobile: `EXPO_PUBLIC_API_URL` (`studia-mobile/.env.example`)
- Admin: `VITE_API_URL` (`studia-admin/.env.example`)
- Backend: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` (`backend/.env.example`)

## Architecture

All three projects use a **feature-based / modular structure** with a parallel layout:
- Frontends: `src/core/` (config, data layer, cross-cutting logic/types), `src/features/<feature>/` (each with `components/ data/ hooks/ logic/ screens|pages/ types/` and an `index` barrel), `src/shared/` (reusable UI, constants, hooks, utils).
- Backend: `src/Core/` (Database, Http, Middleware, Security, Support) and `src/Modules/{Auth,Admin,Instructor,Student}/` each with `Controllers/ Models/ Repositories/ Services/ Validators/`.

Many folders contain only a placeholder `README.md` — they mark where code should go.

### No real backend yet — everything is mocked
- **Mobile**: `features/auth/data/auth-service.ts` is a mock auth service (simulated latency, OTP, lockouts, role checks, hashed mock passwords) whose header documents the intended REST endpoints and DB schema. Logged-in user lives in an in-memory store, `core/data/storage/session-store.ts` (`setUser` / `useUser` / `useRoleUser`). In `__DEV__`, `useRoleUser` falls back to demo users so `/student/*` and `/instructor/*` can be opened directly without logging in. Other screen data comes from `core/data/mock/mock-data.ts`.
- **Admin**: `core/data/api.js` is the **only** module UI code should call. Every function currently delegates to `core/data/mock/mockBackend.js` (in-memory db, hard-coded single admin account — admins cannot register, so there is no register route). To connect a real API, swap the function bodies in `api.js` for fetch calls; components should not change.

### Mobile routing (Expo Router)
- Routes live in `studia-mobile/src/app/`. Route files are **thin re-exports** of screens in features, e.g. `app/instructor/grading.tsx` is just `export { default } from "@/features/instructor/screens/grading-screen";`. Put real UI in `features/<feature>/screens/`, keep non-route code out of `src/app/`.
- Root `app/_layout.tsx` is a header-less `Stack` (loads Poppins fonts, holds splash). `app/student/_layout.tsx` and `app/instructor/_layout.tsx` are `Tabs` using the custom `shared/components/ui/studia-tab-bar.tsx`, configured by a `TABS` record (label, icons, badge, `also` for child routes that should highlight a tab). Non-tab screens in a role group are registered with `options={{ href: null }}`.
- Path alias `@/*` → `src/*` (and `@/assets/*` → `assets/*`).
- Colors come from `shared/constants/studia-colors.ts` (`C`).

### Admin routing
`studia-admin/src/App.jsx` uses react-router-dom: `/login` is public; everything else is wrapped in `ProtectedRoute` (from `features/auth`, backed by `AuthContext`) + `shared/components/Layout`.

## Expo-specific rules (from studia-mobile/AGENTS.md)

- Expo ships breaking changes every SDK release — do not trust memory. Check the `expo` major version in `package.json` and consult `https://docs.expo.dev/versions/v<major>.0.0/` or `https://docs.expo.dev/llms.txt` before using Expo/RN APIs.
- `ios/` and `android/` are generated (CNG); never create or edit them by hand — configure via `app.json` and config plugins.
- Libraries with native code need a development build (`npx expo run:ios|android` or `eas build --profile development`); Expo Go won't include them.
- Prefer official Expo modules over third-party libraries. Use `npx eas-cli@latest <command>` for EAS.
>>>>>>> e324ff9ee7df44118d722a6dc9081989d51a1e3d
