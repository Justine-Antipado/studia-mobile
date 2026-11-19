# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Monorepo for **Studia**, an AI-assisted learning platform for Occidental Mindoro State University –
Mamburao Campus, with three roles: student, instructor, and a single fixed admin. Each sub-project
has its own `package.json`; there is no root workspace, so run commands from inside the sub-project
directory.

| Directory | What it is | Stack |
|---|---|---|
| `studia-mobile/` | Student + instructor app | Expo SDK 58, Expo Router, React Native 0.88, TypeScript (strict) |
| `studia-admin/` | Admin web dashboard | Vite + React 19, React Router 7, plain JSX |
| `backend/` | Planned PHP REST API | **Skeleton only**: folders contain placeholder READMEs, `index.php` is empty, SQL migrations are documentation and are not executed |
| `docs/` | `api-contract.md` (what the backend must build), `ROUTE-MAP.md`, `UI-BRIEF.md`, `database.md`, `architecture.md` | |

There are no tests in any sub-project yet, and no test runner is configured.

## Commands

### studia-mobile
```bash
npx expo start              # dev server (npm start)
npx expo lint               # ESLint (eslint-config-expo)
npx tsc --noEmit            # typecheck
npx expo install <package>  # ALWAYS use instead of npm install for deps — picks SDK-compatible versions
npx expo-doctor             # diagnose dependency/config problems
```
Run lint and typecheck before declaring a mobile task done. Both are currently clean.

### studia-admin
```bash
npm run dev      # Vite dev server
npm run build    # production build
npm run lint     # oxlint
```

### Environment
- Mobile: `EXPO_PUBLIC_API_URL` (`studia-mobile/.env.example`)
- Admin: `VITE_API_URL` (`studia-admin/.env.example`)
- Backend: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` (`backend/.env.example`)

## Key point: everything runs on in-memory mocks

No client talks to a real server yet. Both apps are structured so the mock layer can be swapped for
HTTP calls without touching UI code:

- **Mobile auth**: `studia-mobile/src/features/auth/data/auth-service.ts` is a full mock auth server
  (login, register, OTP verify/resend, Google sign-in, password reset, rate limiting, lockouts,
  typed `AuthError` codes). Seed logins: `student@omsc.edu.ph` / `Student@123`,
  `instructor@omsc.edu.ph` / `Instructor@123`. In `__DEV__`, OTP responses include `devCode`.
- **Mobile feature data**: one repository per domain in `features/<feature>/data/*-repository.ts`,
  each an interface plus a mock implementation, consumed only through that feature's hooks. Swapping
  in the real API means replacing one implementation file per feature.
- **Mobile session**: `src/core/data/storage/session-store.ts` is a tiny `useSyncExternalStore`
  store (`setUser`, `useUser`). `useRoleUser(role)` falls back to a demo user in `__DEV__` so role
  screens can be opened directly after a hot reload without logging in. Ending a session goes
  through `core/logic/sign-out.ts`, which also purges the caches.
- **Admin**: `studia-admin/src/core/data/api.js` is the *only* module UI code may call; each
  function currently delegates to `core/data/mock/mockBackend.js`. The admin account is hard-coded
  there (`admin` / `Studia@2026`); there is intentionally no register route.

`docs/api-contract.md` maps every repository method to the endpoint the backend has to build, and
lists what the server must enforce itself (it must never trust client-side validation). When
changing auth behavior or data shapes, keep the mock, `docs/api-contract.md` and the migrations
consistent.

## Mobile architecture (`studia-mobile/src`)

- `app/` — Expo Router routes only. Route files are one-line re-exports
  (`export { default } from "@/features/student/screens/home-screen"`); put real screen code in
  `features/`, never in `app/`.
  - Root `_layout.tsx`: loads Poppins fonts, holds the splash screen, mounts the app-wide
    `ErrorBoundary` and `ToastProvider`, and defines a header-less `Stack`.
  - Flow: `index` (welcome) → `explore` (role choice) → `auth?role=…` → `student/*` or
    `instructor/*`.
  - **Each role group is an outer `Stack` whose first screen is a `(tabs)` group**
    (`app/<role>/_layout.tsx` + `app/<role>/(tabs)/_layout.tsx`). Sub pages are Stack screens
    pushed over the tab bar, registered in that layout's `SUBPAGE_ROUTES` or `MODAL_ROUTES`.
    `(tabs)` adds no URL segment, so `/student/home` and `/student/course-detail` are both
    unchanged. See `docs/ROUTE-MAP.md` for the full map and why it is not one Tabs navigator.
- `features/<name>/` — feature modules (`auth`, `onboarding`, `student`, `instructor`,
  `shared-screens`), each with `screens/ components/ data/ logic/ hooks/ types/` and an `index.ts`.
- `core/` — cross-feature infrastructure: `types/` (`role.ts`, `content.ts`), `data/` (`cache/`,
  `repository/` generic `useQuery`/`useMutation`, `errors/` `AppError`, `api-client/` stub, `mock/`,
  `storage/`), `config/transitions.ts`, `logic/` (route-param validation, role guard, error sink,
  sign-out).
- `shared/` — role-agnostic UI kit (`components/ui`, imported from its barrel), `constants/`
  (`studia-colors.ts` as `C`/`TONES`/`OVERLAY`, `tokens.ts` for spacing/radius/type/shadow/touch
  targets), `hooks/`, `utils/`.
- Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.

### Conventions that are easy to break

- Colors, spacing, radius, type and shadow come from `shared/constants`; never hard-code a hex or a
  magic number in a screen.
- `AppImage` is the only remote-image renderer, `Icon` the only icon entry point, `AppList` the only
  list. Do not import `expo-image`, RN `Image`, `@expo/vector-icons` or `FlatList` in a screen.
- Lists pass a `useCallback`-wrapped `renderRow` to `AppList`; inline functions or style objects in
  a list defeat the memoized rows.
- Every screen renders inside `Screen`, which supplies the header, the offline banner, keyboard
  safety, the safe-area bottom inset and an `ErrorBoundary`.
- Route params are validated in `core/logic/route-params.ts` before use. Never trust a param.
- Writes go through `useMutation`, which refuses to run while offline and never auto-retries; reads
  go through `useQuery`, which retries only retryable errors.

## Admin architecture (`studia-admin/src`)

Same feature-based layout: `features/{auth,dashboard,users,settings}/` with `pages/`, `components/`,
etc. `App.jsx` wraps all routes except `/login` in `ProtectedRoute` (backed by
`features/auth/context/AuthContext.jsx`) plus the shared `Layout`. Shared UI primitives live in
`shared/components/ui.jsx`; theme tokens in `src/theme.js`.

## Backend conventions (planned)

`backend/src/Core/{Database,Http,Middleware,Security,Support}` for infrastructure and
`backend/src/Modules/{Auth,Student,Instructor,Admin}/{Controllers,Services,Repositories,Models,Validators}`
per domain. Target DB is MySQL (see `001_create_users.sql`). `docs/api-contract.md` is the
specification; its "Server requirements" and "File uploads" sections list the controls that cannot
live on the client (password hashing with argon2id/bcrypt, hashed OTPs, server-side Google ID token
verification, no account enumeration, per-request ownership checks, content-type sniffing on
uploads).

## Expo-specific rules (from `studia-mobile/AGENTS.md`)

- Expo changes a lot between SDK releases, so don't rely on memory for APIs. Check the `expo` major
  version in `package.json` and consult `https://docs.expo.dev/versions/v<major>.0.0/` or
  `https://docs.expo.dev/llms.txt`.
- `ios/` and `android/` are generated (Continuous Native Generation). Never create or edit them by
  hand; configure native behavior through `app.json` and config plugins.
- Libraries with native code need a development build (`npx expo run:ios|android` or
  `eas build --profile development`), not Expo Go.
- Prefer official Expo modules over third-party libraries. Use EAS (`npx eas-cli@latest …`) for
  builds, submission, and OTA updates.
