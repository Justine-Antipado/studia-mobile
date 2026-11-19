# STUDIA Admin — Phase 0 audit

**Date:** 2026-11-19 · **Scope:** `studia-admin/` only (read-only pass; no app code changed)
**Audience:** whoever implements Phase 1+ (including a future chat session). Read this before
`docs/admin-progress.md`.

Files inspected: `App.jsx`, `main.jsx`, `theme.js`, `index.css`, `index.html`, `vite.config.js`,
`.oxlintrc.json`, `.env.example`, `shared/components/{Layout,ui,GlobalSearch}.jsx`,
`shared/utils/flash.js`, `core/data/api.js`, `core/data/mock/{mockBackend,mockData}.js`,
`features/auth/*`, `features/dashboard/pages/Home.jsx`, `features/users/pages/Users.jsx`,
`features/settings/pages/Settings.jsx`, `src/assets/`, `public/`, plus
`studia-mobile/src/features/auth/logic/auth-validation.ts`,
`studia-mobile/src/features/auth/data/auth-service.ts` (config block) and the mobile `types/`
folders (`core/types/{role,content}.ts`, `features/{student,instructor,shared-screens}/types/*`).

## 1. Baseline (verified, not assumed)

| Check | Result |
|---|---|
| `npm run lint` | passes — 0 errors, **3 warnings**, all `react/only-export-components` (`ui.jsx:3`, `ui.jsx:93`, `AuthContext.jsx:36`) |
| `npm run build` | passes in ~0.4 s, 41 modules |
| JS bundle | **293.84 kB** (92.45 kB gzip) in **one chunk** — no code splitting |
| CSS bundle | 13.75 kB (3.57 kB gzip) |
| Image payload | **~4.1 MB raw**: `studia-mascot.png` 1.998 MB, `studia-logo.png` 1.060 MB, `omsu-logo.png` 0.989 MB, `omsu-campus.jpg` 0.044 MB |
| Routes implemented | 3 of ~30 required (`/`, `/users`, `/settings`) + `/login` |
| Features scaffolded | 4 of 13 required (`auth`, `dashboard`, `users`, `settings`) |
| Source size | 11 JS/JSX files + 258 lines of CSS |

So the current app is roughly 10 % of the target surface, but the 10 % that exists is mostly
well-built. The main structural debt is in *data architecture* and *security/accessibility plumbing*,
not in the component code.

## 2. Verdict per file

| File | Verdict | Why |
|---|---|---|
| `theme.js` | **Keep, extend** | Palette matches mobile; needs spacing/z-index/motion tokens |
| `shared/components/ui.jsx` | **Keep, split** | Good primitives; split components / `Icon` / `initials` to clear the lint warnings |
| `core/data/api.js` | **Keep the contract, rewrite the body** | Single-gateway rule is respected; must delegate to repositories + `http/client.js` |
| `core/data/mock/mockBackend.js` | **Keep the patterns, reshape** | Latency + `structuredClone` isolation are right; data shape and admin-credential handling are wrong |
| `core/data/mock/mockData.js` | **Reshape** | User shape cannot support the required filters; 11 domains missing |
| `features/auth/pages/Login.jsx` | **Rebuild** | Not glassmorphism; demo credentials hard-coded in JSX |
| `features/auth/context/AuthContext.jsx` | **Move + harden** | Belongs in `core/`; token in `localStorage`, no idle timeout, no 401 hook |
| `features/auth/components/ProtectedRoute.jsx` | **Keep, extend** | Correct redirect + `state.from`; needs a role check and a 403 path |
| `features/dashboard/pages/Home.jsx` | **Rename + rebuild** | To `Dashboard.jsx`; charts are reusable, the rest is placeholder |
| `features/users/pages/Users.jsx` | **Rebuild on `DataTable`** | Selection/CSV/confirm logic is worth porting; the table itself is not |
| `features/settings/pages/Settings.jsx` | **Split into a hub + 9 sub-pages** | 300 lines, three concerns in one file |
| `shared/components/Layout.jsx` | **Rebuild from `navigation.js`** | Hard-coded nav; imports `features/` from `shared/` |
| `shared/components/GlobalSearch.jsx` | **Delete** | Product owner removed topbar search |
| `shared/utils/flash.js` | **Delete with it** | Exists only to serve GlobalSearch deep links |
| `index.html` | **Rewrite head** | No CSP, no description, no `theme-color`, no robots; title is `studia-admin` |
| `public/icons.svg` | **Delete** | Unreferenced Vite-template leftover (bluesky/discord/github/x/social/documentation symbols) |
| `public/favicon.svg` | **Replace** | Generic purple glyph, not STUDIA/OMSU |
| `.env.example` | **Extend** | Contains only `VITE_API_URL=` |
| `vite.config.js` | **Extend** | No `@/` alias, so every import is `../../../` |
| All 25 `README.md` stubs | **Fill or drop** | One-liners; `features/README.md` literally reads `# undefined` |
| `studia-admin/src-admin.zip` | **Delete** | 4 MB untracked archive sitting in the project folder |

## 3. What works well — preserve this

**Data-layer discipline (the single most valuable thing here).** A grep confirms only `api.js`
imports `mock/mockBackend`; every page imports `core/data/api` and nothing deeper. The swap to HTTP
is genuinely a one-file change today. Keep that invariant when splitting into repositories.

**The mock backend behaves like a server.** `delay()` on every call, `structuredClone` on read *and*
write so callers cannot mutate the in-memory db by reference, OTP with a real `expiresAt`, and
`console.info` of the dev OTP code instead of rendering it. This mirrors the mobile mock's
philosophy and should survive the reshape.

**UI primitives are small and correct.** `Toggle` is a real `role="switch"` with `aria-checked`.
`Modal` closes on Escape and stops backdrop propagation via `onMouseDown`, so a drag that ends
outside does not dismiss it. `Toast` auto-dismisses on a 3.2 s timer keyed to the message. `Avatar`
strips a leading `Prof.` before taking initials. `Icon` is 14 hand-written inline SVGs sharing one
props object — no icon library, which matches the no-new-dependencies rule. Reuse all of these.

**Users page logic worth porting verbatim.** `Set`-based selection; select-all scoped to *visible*
rows only; `blockIds`/`unblockIds` derived from status so a bulk action cannot block an already
blocked user; bulk actions clear the selection while per-row actions deliberately do not; CSV export
that escapes `"` correctly; a per-row `aria-label` on each checkbox; a confirm modal that names the
single user being deleted.

**Settings OTP flow is better than most.** Six boxes with auto-advance, backspace-to-previous,
auto-verify once all six are filled, a resend cooldown that counts down, and step gating — the
password fields stay `disabled` until the OTP verifies. Port the interaction; fix the policy
(section 7.3).

**Layout drawer mechanics.** An Escape listener bound only while open, backdrop click to close, nav
closes on navigate, `aria-expanded` on the menu button, `100dvh` on the drawer.

**CSS is honest and flat.** 258 lines, no preprocessor, no nesting, flat class names, and `:root`
fallbacks duplicated in CSS so the page still renders if `applyThemeVars()` has not run. Breakpoints
already exist at 1200 / 1024 / 900 / 600 / 380 px. The palette is identical to mobile's
`studia-colors.ts`.

**Self-documented debt.** `// TODO(refactor):` comments already mark the `shared → features` import
inversion and the un-split pages. The previous author knew; nothing here is accidental.

**Assets are all present:** `omsu-campus.jpg`, `omsu-logo.png`, `studia-logo.png`,
`studia-mascot.png`. The glassmorphism login has everything it needs.

## 4. What needs fixing

### 4.1 Correctness bugs (real, not stylistic)

1. **Every data fetch is missing a `.catch`.** `Home.jsx` (`api.getDashboard().then(setData)`),
   `Users.jsx` (`api.getUsers().then(...)`), `Settings.jsx` (`reload()` and `saveEmail()`'s
   `await onSave(...)`) have no rejection handler. Any API failure means an unhandled promise
   rejection and a page stuck on "Loading…" forever. There is **no `ErrorBoundary` anywhere**, so a
   throw during render blanks the whole app.
2. **No unmount cleanup or `AbortController`** on any fetch, so React 19 StrictMode's double-mount
   fires two requests and can `setState` after unmount.
3. **Poppins is never loaded.** `index.css:12` sets `font-family: 'Poppins', …` but there is no
   `@font-face`, no Google Fonts `<link>`, and no font file anywhere in the project. The app is
   silently rendering in `system-ui` today. Fix by self-hosting or linking the font.
4. **`Avatar` ignores the real admin name.** `Layout.jsx` renders `<Avatar name="Admin" />` and a
   hard-coded `<strong>Admin</strong>` while showing `admin?.email` beside it; `Settings.jsx`
   renders `<Avatar name="AD" />`. The session already carries `admin.name === 'OMSU Administrator'`.
5. **The table footer lies.** `Users.jsx` prints "Rows per page: 10" as static text while rendering
   every row. There is no pagination at all.
6. **`strength()` contradicts the mobile password policy** (see 7.3); the "Update password" button
   enables at a score of 2 out of 4.
7. **`link-danger` "Delete Users"** in the dashboard's Recent Registrations card is a red,
   destructive-looking link that merely navigates to `/users`. Misleading affordance.

### 4.2 Architecture gaps vs. section 6 of the master prompt

- No `core/data/http/client.js` (the folder exists with a stub README): no base-URL wiring, no
  bearer header, no timeout, no `AbortController`, no normalized
  `{ status, code, message, fieldErrors }`, no 401-to-`/login` redirect, no refresh-token hook.
- No per-feature repositories, no mappers (snake_case to camelCase), no list envelope
  (`{ data, meta: { page, pageSize, total } }`), no server-shaped params
  (`page`, `pageSize`, `sort`, `order`, `q`, filters).
- **Zero hooks exist.** `shared/hooks/` and every `features/*/hooks/` folder contain only a README.
  All six required hooks (`useAsync`, `useQueryState`, `usePagination`, `useDebounce`,
  `useDocumentTitle`, `useIdleTimeout`) are unwritten.
- `core/config/` is empty: no `env.js`, `demoCredentials.js`, `routes.js` or `navigation.js`. Nav
  items, page titles and the search-exclusion list are hard-coded inside `Layout.jsx`.
- `shared/components/Layout.jsx` imports `features/auth/context/AuthContext`, so `shared` depends on
  `features`, inverting the layering. Moving `AuthContext` to `core/` fixes this *and* the
  `settings → auth` cross-feature import in `Settings.jsx`.
- No route nesting in `App.jsx`, no `React.lazy`/`Suspense`, no 404 page (`*` silently `Navigate`s
  to `/`), no 403 page, no breadcrumbs, no `PageHeader`, no `DataTable`, no `Skeleton`, no
  `EmptyState`, no `Tabs`, no `ConfirmDialog`.
- No `@/` alias in `vite.config.js`; `Settings.jsx` reaches up `../../../shared/components/ui`.

### 4.3 Security gaps vs. section 7

- **Credentials in the bundle, twice.** `mockBackend.js` holds `password: 'Studia@2026'` and
  `Login.jsx` prints `admin@omsu.edu.ph` / `admin` / `Studia@2026` in a `<details>` block in JSX.
  Both ship to the browser. These must collapse into `core/config/demoCredentials.js`, gated on
  `VITE_USE_MOCK`, so that deleting that one file plus the flag still compiles.
- **Token in `localStorage`.** `AuthContext` writes `{ token, admin }` under
  `studia_admin_session`. No token module, no idle timeout, no multi-tab logout sync, no 401
  clearing.
- **Almost no client-side validation.** Login only checks non-empty. No email-domain rule, no length
  caps, no 6-digit OTP shape check — while mobile already exports `LIMITS`, `isEmail`, `isOtp`,
  `PASSWORD_RULES` and `normalizeEmail`.
- **No login throttling UI** (no attempt counter, no lockout message), though the generic error text
  (`'Invalid email/username or password.'`) is correctly non-enumerating — keep that wording.
- **`ProtectedRoute` checks `isAuthed` only** — no role check, and no 403 destination.
- **`index.html` ships no security or SEO head at all:** no CSP meta, no referrer policy, no
  `noindex, nofollow` (this is a private portal), no description, no `theme-color`, no OG tags, and
  the title is the scaffold default `studia-admin`. There is no `public/robots.txt`.
- Positive note: **no `dangerouslySetInnerHTML` anywhere** — the terms editor is already a plain
  `<textarea>`. Keep it that way.

### 4.4 Accessibility and motion

- `Modal` has no `role="dialog"`, no `aria-modal`, no focus trap, no focus restore on close, and no
  labelled-title association.
- `Toast` is not in an `aria-live` region, so screen readers never hear it.
- The Users filter `.chips` are plain buttons, not a `role="tablist"`.
- The topbar is a `<div>`, not a `<header>`; there is no skip-to-content link; there is no focus
  management after a route change. (`<main>`, `<aside>`, `<nav>` and a single `h1` per page are
  already correct.)
- **No `prefers-reduced-motion` block exists**, yet the CSS animates the flash keyframes, bar
  heights, the toggle knob and the drawer transform.

### 4.5 Responsiveness

The required "table to stacked cards below ~720 px" does not exist. `Users` only gets a horizontal
scroll container (`.table-scroll` with negative margins). Below 900 px the login page **hides the
entire hero** (`.login-hero { display: none }`), so the campus photo, mascot and both logos vanish on
phones — exactly the branding the glassmorphism rebuild is meant to foreground.

### 4.6 Performance

- ~4.1 MB of unoptimized PNGs. `studia-mascot.png` alone is 1.998 MB and renders at
  `min(240px, 55%)`. Resize and convert to WebP/AVIF with a PNG fallback; this is the single biggest
  user-visible win available.
- One 294 kB JS chunk; route-level `React.lazy` is required by section 7 and not started.

## 5. What to remove

### 5.1 Topbar search (prompt item 2)

Delete `shared/components/GlobalSearch.jsx`, the `PAGES_WITHOUT_SEARCH` array and `.topbar-spacer`
in `Layout.jsx`, and roughly 20 `.search*` selectors in `index.css` (`.search`, `.search-wrap`,
`.search-results`, `.search-group`, `.search-item`, `.search-icon`, `.search-text`, `.search-empty`,
`.search-clear`, plus their `@media` overrides). `Icon.Search` stays — in-table search needs it.

Cascade: `flash.js`, the `flash-card`/`flash-row` keyframes, `.flash-target`, `scroll-margin` on
`.card`, and the `location.state.highlight` / `location.state.focus` plumbing in `Users.jsx` and
`Settings.jsx` (including both `handledKey` refs) exist *only* to animate GlobalSearch deep links.
Remove them with it, unless we deliberately reuse `flashElement` for `/users/:id` anchors.
Recommendation: remove, and add it back only if a real need appears.

### 5.2 Pending / approval flow (prompt item 3)

Remove in this order so nothing dangles:

- `mockData.js`: user id 5 (`Prof. Ramon Reyes`, status `Pending`) becomes Active; drop
  `mockStats.pending`.
- `mockBackend.js`: `approveUser()`, and the `pending:` count inside `getDashboard()`.
- `api.js`: `export const approveUser`.
- `Users.jsx`: `'Pending'` from `FILTERS`, its `matchesFilter` case, the Approve `link-btn`, and the
  `approve()` handler.
- `Home.jsx`: the `['Pending', stats.pending]` tile.
- `ui.jsx`: `STATUS_CLASS.Pending` (and `badge-orange` if nothing else claims it).
- `docs/api-contract.md:285` documents `approveUser` as "the instructor approval gate" — update it.

This is consistent with mobile: `auth-service.ts` already ships
`REQUIRE_INSTRUCTOR_APPROVAL = false`, so nothing on the mobile side depends on admin approval and
the removal is safe. The `ACCOUNT_PENDING` auth error code stays in mobile — out of scope, and
harmless.

### 5.3 Per-row Block / Unblock (prompt item 4)

Remove the two `link-btn` buttons from the Status cell in `Users.jsx`; the header buttons
(`Unblock (n)` / `Block (n)`) become the only path, driven by selection. Keep `changeStatus()` — it
already handles both bulk and row calls; just stop calling it per row. `.link-btn.warn` likely
becomes unused.

### 5.4 Home to Dashboard (prompt item 1)

Rename the file, the route (`/dashboard`), the nav label and the `h1`; `/` redirects. Delete the
`link-danger` "Delete Users" card action (4.1 item 7). The `BarChart` and `Donut` components are
decent hand-written SVG/CSS and should move into `shared/components/Chart*` rather than be thrown
away.

### 5.5 Repo hygiene

`studia-admin/src-admin.zip` (4 MB, untracked) and `public/icons.svg` (unreferenced template
leftover) should both go. `studia-mobile/src (3).zip` is also untracked at the repo root but sits
outside this project's boundary — flagging only, not touching.

## 6. What does not exist yet

Of the ~30 required routes, 3 exist. Missing entirely, with **no mock data of any kind**:
`/users/:id`, `/classes`, `/classes/:id`, `/content`, `/assessments`, `/announcements`, `/ai`,
`/reports`, `/notifications`, `/security` plus its 4 sub-pages, the 9 `/settings/*` sub-pages,
`/help`, 404 and 403.

Nine of the thirteen required feature folders do not exist (`classes`, `content`, `assessments`,
`announcements`, `ai`, `reports`, `notifications`, `security`, `help`).

**Mock data must be reshaped, not just extended.** Today a user is
`{ id, name, email, role, section, status, joined, lastActive }` where `section` is free text —
`'BSIT 3-A'` for students but `'IT Dept'` for instructors. The required filters (course, year,
section, department) cannot be derived from that. Proposed shape, aligned with mobile's
`auth-validation.ts`:

```
{ id, name, email, role, course, year, section, department,
  sectionLabel, // composeSection(course, year, section) -> "BSIT 3-A", kept for DB compatibility
  status, joinedAt, lastActiveAt } // ISO dates, not 'Aug 12, 2026'
```

Dates should be stored ISO and formatted in `core/logic/format.js`, not pre-formatted in the mock.
`mockSettings.backup.lastBackup` (`'Nov 16, 2026 · 2:00 AM · 1.8 GB'`) is a display string
masquerading as data, and `runBackup()` rebuilds it with `toLocaleString`.

`getDashboard()` also returns `recent: [...users].slice(-3).reverse()` — "recent registrations"
derived from array position rather than `joinedAt`. Fix once dates are ISO.

## 7. Contradictions — decide these before Phase 1

These are genuine conflicts between the master prompt, the admin code, the mobile code and
`CLAUDE.md`. A recommendation is given for each; please confirm or override.

**7.1 Email domain — `@omsu.edu.ph` vs `@omsc.edu.ph`.** The master prompt, the branding and the
whole admin mock use **omsu**. Mobile is split: `auth-service.ts:126,140` seeds
`student@omsc.edu.ph` / `instructor@omsc.edu.ph` and `students-repository.ts:22` generates
`@omsc.edu.ph`, while `session-store.ts:44,52` and `account-screen.tsx:39,49` use `@omsu.edu.ph`.
`CLAUDE.md` documents the omsc seed logins. Mobile's `auth-validation.ts` enforces **no domain at
all** (`EMAIL_RE` accepts any domain). *Recommendation:* the admin validates `@omsu.edu.ph` per the
master prompt, and we record the mobile inconsistency here as a known defect for the mobile side —
`studia-mobile/` is out of bounds for this work.

**7.2 Status vocabulary — `Active | Blocked | Pending` vs `Active | Inactive`.** Prompt item 4 keeps
Block/Unblock as header buttons; prompt item 5 says the status filter offers "Active / Inactive
only". Both cannot be literal unless Block *is* what makes a user Inactive. *Recommendation:* status
becomes `Active | Inactive`; the header Block button sets `Inactive` and Unblock sets `Active`;
`blockUsers`/`unblockUsers` keep their names and their guard (block only touches Active, unblock only
touches Inactive). Badge colours green and red.

**7.3 Password policy — three different rules in one codebase.** Mobile
(`auth-validation.ts`): five rules, **all required** — at least 8 chars, one lowercase, one
uppercase, one digit, one symbol, max 64 (`isStrongPassword` requires `passwordScore === 5`). Admin
`Settings.jsx`: a local 4-point `strength()` heuristic whose submit button enables at **2**. Admin
`mockBackend.updatePassword`: rejects only `length < 8`. *Recommendation:* port mobile's
`PASSWORD_RULES` / `passwordScore` / `isStrongPassword` into `core/logic/validation.js` verbatim,
require all five, show the rule checklist instead of a score meter, and re-run the same check inside
the mock so client-only validation is never the only gate — mobile's stated principle.

**7.4 OTP parameters.** Mobile: TTL 5 min, resend 30 s, **max 5 attempts** then lock. Admin: TTL from
`settings.email.otpExpiryMinutes` (5), resend from `settings.email.resendSeconds` (**60**), and **no
attempt cap at all**. *Recommendation:* keep the admin values configurable — the Settings page exists
to set them — but seed the defaults to mobile's 5 min / 30 s, and add the 5-attempt lock to the mock.
Shape validation uses mobile's `isOtp` (`/^\d{6}$/`).

**7.5 Instructors have departments, not sections.** Mobile exports
`DEPARTMENTS = ['FM','OM','IT','ED']` separately from `COURSES`/`YEARS`/`SECTIONS`, and the admin
mock crams both into one `section` field. *Recommendation:* use the shape in section 6 — students
carry course/year/section, instructors carry department, and `sectionLabel` is derived for display.
The Users table shows one "Section / Dept" column driven by role.

**7.6 University name and abbreviation.** Login says "Occidental Mindoro State University";
`CLAUDE.md` says "Occidental Mindoro State University – Mamburao Campus"; the asset is `omsu-logo`
but `CLAUDE.md`'s seed emails say omsc. *Recommendation:* "Occidental Mindoro State University —
Mamburao Campus", abbreviated **OMSU**, matching the assets and the master prompt.

**7.7 Token storage.** The master prompt prefers in-memory plus an httpOnly cookie "when the backend
supports it"; there is no backend. *Recommendation:* hold the token in a single in-memory module
(`core/data/http/token.js`), plus a non-sensitive `{ hasSession: true }` hint in `localStorage` so a
refresh does not log you out during mock development, with a comment and an `api-contract.md` note
saying the real deployment moves to an httpOnly cookie. This satisfies "token isolated in one module,
cleared on logout and on 401".

**7.8 Scope reality check.** 30 routes, 13 features, a DataTable, 6 hooks, an HTTP client, 9 settings
sub-pages, 4 security sub-pages, charts, a glassmorphism login rebuild and the full
security/a11y/SEO bar is a large build and will not land in one phase. Section 8 proposes an order.
The "no component over ~250 lines" rule and `navigation.js`-as-single-source are what make the later
phases cheap, so they come first.

## 8. Recommended phase order (proposal — not started)

Each phase ends green on `npm run lint` and `npm run build`, is checked at 360 / 768 / 1024 /
1440 px with keyboard and reduced-motion verified, and updates `docs/admin-progress.md`.

1. **Foundation.** `core/config/{env,navigation,routes,demoCredentials}.js`;
   `core/data/http/{client,token}.js`; `core/logic/{validation,format,mappers}.js` (validation ported
   from mobile); move `AuthContext` to `core/`; `@/` alias; extended `.env.example`; mock-vs-HTTP
   switch behind `VITE_USE_MOCK`. No visual change.
2. **Shell and primitives.** New `Sidebar`/`Topbar`/`Layout` driven by `navigation.js` (grouped,
   collapsible, drawer, badges, bottom user menu); `Breadcrumbs`, `PageHeader`, `DataTable`,
   `Skeleton`, `EmptyState`, `ErrorBoundary`, `Tabs`, `ConfirmDialog`; the 6 hooks; lazy routes plus
   404/403; the `index.html` head (CSP, robots, OG, theme-color) and `robots.txt`;
   `prefers-reduced-motion`; token additions to `theme.js`; delete GlobalSearch and flash; load
   Poppins; optimize the 4 MB of images.
3. **Auth.** Glassmorphism login, throttling UI, idle timeout with warning modal, multi-tab sync,
   role guard, and the demo-credentials box behind the flag.
4. **People.** Dashboard rebuild (charts moved to `shared`), `/users` on `DataTable` with the real
   filter set plus pagination and sort, `/users/:id`, the pending/block removals, and the reshaped
   user mock.
5. **Academics.** `/classes`, `/classes/:id`, `/content`, `/assessments`, `/announcements` (the one
   create-capable area) and their mocks, modelled on the mobile types.
6. **Intelligence and System.** `/ai`, `/reports`, `/notifications`, `/security` (4 sub-pages),
   `/settings` hub (9 sub-pages), `/help`.
7. **Hardening.** `docs/api-contract.md` admin section rewritten against the real repositories, an
   a11y sweep, a bundle check, and a final responsive pass.

## 9. Appendix — rules to mirror from mobile (single source of truth)

From `studia-mobile/src/features/auth/logic/auth-validation.ts`:

- `LIMITS = { name: 80, email: 254, password: 64 }`
- `COURSES = ['BSIT','BEED','BSBA-FM','BSBA-OM']`, `YEARS = ['1','2','3','4']`,
  `SECTIONS = ['A','B','C','D','E']`, `DEPARTMENTS = ['FM','OM','IT','ED']`
- `composeSection(course, year, section)` produces `'BSIT 3-A'`
- `normalizeEmail` is trim plus lowercase; `normalizeName` is trim plus whitespace collapse
- `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` (plus the omsu domain rule per 7.1)
- `NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]{1,79}$/`
- `isOtp = /^\d{6}$/`
- `PASSWORD_RULES` — the five all-required rules, with `passwordScore` and `isStrongPassword`
- `validateField(key, raw, ctx)` with `ctx.strict = false` on login so password rules are never
  revealed to an unauthenticated visitor — **keep this behaviour in the admin login**

From `auth-service.ts` config: `OTP_TTL_MS` 5 min, `OTP_RESEND_MS` 30 s, `OTP_MAX_ATTEMPTS` 5,
`LOGIN_MAX_FAILS` 5, `LOGIN_LOCK_MS` 60 s, `TOKEN_TTL_MS` 10 min. Use `LOGIN_MAX_FAILS` and
`LOGIN_LOCK_MS` for the login throttling UI, and `TOKEN_TTL_MS` as a sanity bound on
`VITE_SESSION_IDLE_MINUTES`.

Domain types to model the admin's read-only views on — mirror these shapes, do not redefine them:
`InstructorClass` (`code`, `title`, `section`, `studentCount`, `joinCode`, `archived`),
`ClassStudent`, `Announcement` (`pinned`, `comments`), `Material`/`Lesson`
(`kind: 'video'|'pdf'|'slide'`, `processing: 'processing'|'ready'|'failed'`, `transcript`,
`objectives`), `InstructorAssignment` (`allowLate`, `points`, `dueAt`), `Quiz`
(`source: 'manual'|'ai'`, `status: 'draft'|'published'`), `QuizQuestion`
(`type: 'multiple_choice'|'identification'|'essay'`, `bloom`, `difficulty`), `BloomLevel` (6 levels),
`Difficulty` (Easy/Medium/Hard), `Submission`, `AnalyticsData`
(`engagement`/`consumption`/`struggling`), `NotificationItem` (`tag`, `unread`), `Attachment`
(`kind`, `sizeLabel`), `Comment`.

Two details worth copying: `Material.processing` already has the three states `/content` needs, and
`AnalyticsData` already names the three campus-wide report axes. The admin should aggregate these
rather than invent parallel vocabulary.
