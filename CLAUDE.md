# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Studia is a learning-management system for OMSU with three independent sub-projects (no root package.json / workspace tooling — run commands inside each folder):

- `studia-mobile/` — Expo (SDK 58) + React Native + TypeScript app for **students and instructors**.
- `studia-admin/` — React 19 + Vite + JavaScript (JSX) web dashboard for the single **admin** account.
- `backend/` — PHP backend. Currently **scaffolding only**: `index.php` is empty and module folders contain placeholder READMEs. The SQL files in `database/migrations/` are copied from the documented schema in the mobile auth service and are not executed or wired to anything.
- `docs/` — `api-contract.md` holds the auth endpoint map/contract (copied from `studia-mobile/src/features/auth/data/auth-service.ts`); other docs are stubs.

## Commands

### studia-mobile
```bash
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
