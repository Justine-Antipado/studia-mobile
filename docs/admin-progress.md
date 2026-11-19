# STUDIA Admin — build progress

Handoff file for the admin portal rebuild (`studia-admin/`). **Read this first in every new
session**, then `docs/MASTER-PROMPT.md` for the full brief and `docs/api-contract.md` for the
endpoints the UI assumes.

| | |
|---|---|
| Last phase finished | **Phase 8 — polish and hardening** (the UI is feature-complete) |
| Date | 2026-11-20 |
| Next phase | **Phase 9 — the browser pass**: the one thing no script can do, then the PHP backend |
| `npm run lint` (oxlint) | clean, 0 errors, 0 warnings — now with `no-undef` on |
| `npm run build` | clean, one chunk per route; `dist/` down from ~4.8 MB to 768 kB |
| Checks | `node scripts/check-contrast.mjs` 55/55 · `check-routes.mjs` 29/29 · `check-api.mjs` 91 assertions — all passing |
| Demo-removal invariant | **re-verified in phase 8**: file deleted + `VITE_USE_MOCK=false` → clean build, no credential in `dist/` |

---

## Phase 1 — done

### Config (`src/core/config/`)

- `env.js` — the only place `import.meta.env` is read: `apiUrl`, `useMock`, `appName`,
  `sessionIdleMinutes`.
- `routes.js` — every path as a constant, plus `path(template, params)`.
- `navigation.js` — **single source of truth** for the sidebar groups, the breadcrumbs and the
  document titles. `NAV_GROUPS`, `NAV_PAGES`, `findPage`, `breadcrumbsFor`, `titleFor`,
  `descriptionFor`, `activeItemFor`. Adding a tab means editing this file and adding a lazy route.
- `demoCredentials.js` — the only credential in the repo, read through `demo.js`
  (`import.meta.glob`, so deleting the file still builds — verified by building with it removed).

### Data layer (`src/core/data/`, `src/core/logic/`)

- `http/client.js` — base URL, bearer token, JSON, 15 s timeout, caller `AbortSignal`, one
  normalized error, one refresh attempt on 401 then redirect to `/login`.
- `http/errors.js` — `ApiError { status, code, message, fieldErrors, retryable }`, `fail()` for the
  mock, `toApiError`, `isAborted`.
- `http/tokenStore.js` — in-memory token + a `localStorage` session marker; `storage` events give
  multi-tab logout sync.
- `http/httpBackend.js` and `mock/mockBackend.js` — same methods, same shapes, same errors.
  `api.js` picks one from `VITE_USE_MOCK` and stays the single gateway.
- `logic/mappers.js` — `toUi`/`toApi` (snake ↔ camel), `toList`, `toListParams`, and
  `applyListParams` so the mock can honour the same `page/pageSize/sort/order/q/filters`.
- `logic/validation.js` — JS port of the mobile `auth-validation.ts` rules (password rules, 6-digit
  OTP, email + `@omsu.edu.ph`, courses/years/sections/departments, length caps, `sanitizeSearch`).
- `logic/format.js` — numbers, bytes, dates, relative time, countdown, initials.

### Hooks (`src/shared/hooks/`)

`useAsync` + `useMutation` (abort on unmount, no auto-retry on writes, refuses to write while
offline), `useQueryState` (URL-synced filters/page, resets the page when a filter changes),
`usePagination`, `useDebounce`/`useDebouncedCallback`, `useDocumentTitle` (title + meta
description), `useIdleTimeout`, `useMediaQuery`/`useIsCompact`/`usePrefersReducedMotion`,
`useOnlineStatus`.

### Design tokens

`src/theme.js` now exports `SPACE`, `RADIUS`, `SHADOW`, `Z`, `MOTION`, `TYPE`, `LAYOUT` and pushes
them to CSS variables next to the palette; `index.css` carries the same values as fallbacks and
uses them throughout (`--space-4`, `--radius-lg`, `--shadow-card`, `--motion-base`, `--z-modal`…).
`--radius` and `--shadow` are kept as aliases so nothing old broke.

### Shell (`src/shared/components/`)

`Layout` (grid shell, skip link, idle warning, offline banner, per-route `ErrorBoundary` keyed on
the pathname), `Sidebar` (grouped sections with labels, icons, active indicator with a rail,
nested sub-pages for the active section, badge counts, collapsible on desktop and remembered in
`localStorage`, drawer under 1024px, user menu with logout), `Topbar` (**no search** — page name,
"Mock data" pill, notifications), `Breadcrumbs`, `PageHeader` (breadcrumbs + optional Back +
exactly one `<h1>` + subtitle + actions), `PageTransition` (fade-and-rise plus focus move to the new
page), `Skeleton`/`SkeletonCards`/`SkeletonTable`/`PageSkeleton`, `EmptyState` (mascot),
`ErrorBoundary`, `ConfirmDialog` (optional type-the-word gate), `IdleWarning`, `OfflineBanner`,
`Icon` (one file, referenced by name from `navigation.js`), `ComingSoon` (scaffolding).

### Routing

`App.jsx` is all `React.lazy` + one `Suspense` with `PageSkeleton`. `/` and `/home` redirect to
`/dashboard`; the whole IA from the brief has a route; `*` renders a styled 404 and `/403` a 403.
Pages not built yet render `ComingSoon`, which already shows the final title, subtitle and
breadcrumbs.

### Removals

`GlobalSearch.jsx` and its CSS are gone, and so is the topbar search. The pending/approval flow is
gone end to end: no `Pending` status in the mock data or the badge map, no `approveUser` in
`api.js`/`mockBackend`, no pending KPI tile, no `Pending` filter chip. The per-row Block/Unblock
links are gone from the users table — status is a label, and blocking happens through the header
buttons on the selection, as asked.

### Other

- `index.html`: CSP + `referrer` + `noindex, nofollow` meta tags, `theme-color`, Open Graph, and
  the Poppins stylesheet (the CSS always assumed it but nothing loaded it).
- `public/robots.txt`: `Disallow: /`.
- `.env.example`: all four variables, documented.
- `features/auth` split so each file exports one kind of thing: `context/auth-context.js` (context),
  `context/AuthContext.jsx` (provider), `hooks/useAuth.js` (hook). `ProtectedRoute` now also checks
  the admin role and sends a non-admin to `/403`.

---

## Phase 2 — done

Scope was auth-only this phase (narrower than the "Users + login" bundling this file originally
proposed as phase 2 — login/security landed now, the `/users` rebuild on `DataTable` moves to
phase 3 below). Everything else prompt section 7 asks of auth (idle timeout, multi-tab logout,
route guard, CSP/meta, `.env.example`) was already built in phase 1 and is unchanged.

- **Glassmorphism login (`features/auth/pages/Login.jsx`, `index.css`).** The split hero/panel
  layout is gone. The whole viewport is now the campus photo plus the purple gradient
  (`.login-overlay`); a single centered column (`.login-stage`) holds the mascot, both logos and
  the tagline, then the form card. The card itself is the glass surface — translucent white,
  `backdrop-filter: blur(22px) saturate(160%)`, `var(--shadow-glass)` (a token that already
  existed in `theme.js` but nothing used it) — and animates in on mount (`login-card-in`,
  opacity + rise), caught by the existing global `prefers-reduced-motion` rule like every other
  animation in the app.
  - This also fixes an audit finding: the old layout hid `.login-hero` below 900px, so the mascot
    and both logos disappeared on phones. The new single-column stage never hides them.
- **Caps-lock hint.** The password field's `onKeyDown`/`onKeyUp` check
  `e.getModifierState('CapsLock')`; a `role="status"` hint appears next to the field and joins
  `aria-describedby` on the input.
- **Login throttling, enforced server-side (mock mirrors a real server).** Added
  `LOGIN_MAX_FAILS` (5) and `LOGIN_LOCK_MS` (60 s) to `core/logic/validation.js`, matching
  `studia-mobile`'s `auth-service.ts` exactly. `mockBackend.login` now tracks fails and
  `lockedUntil` in the in-memory db: a wrong credential below the limit throws **401** with
  `meta: { attemptsLeft }`; hitting the limit throws **429** with `meta: { retryAfterSec }` and
  locks real wall-clock time, not just a UI flag. `Login.jsx` shows the attempts-left line, then
  switches to a ticking lockout countdown (`formatCountdown`) and disables both fields and the
  submit button until it expires.
  - `ApiError` gained a `meta` field (display-only extras, never the authority — `status`/`code`
    still are) so this works the same whether the mock or the real HTTP backend answers;
    `http/client.js`'s `errorFromResponse` now also reads `payload.meta`. Documented in
    `docs/api-contract.md` (`login` row, plus the general error-shape note) as
    `meta: { attempts_left }` / `meta: { retry_after_sec }` so the PHP side knows the contract.
- **Loading state** got an actual spinner (`.btn-spinner`, spins `Icon.Refresh`) instead of just
  disabling the button.
- **Accessible errors.** The credential error and the lockout message share one `role="alert"`
  region (`#login-error`); both inputs set `aria-invalid`/`aria-describedby` onto it. The ticking
  countdown text itself is `aria-hidden` (only the static sentence is announced) so a screen
  reader isn't re-interrupted every second.
- Removed the now-dead `.login-hero*`, `.login-panel`, `.login-card-logo` CSS rules.

---

## Phase 3 — done

Scope was narrower than the "Users" phase this file originally pointed at next: build the shared
*components* (`DataTable` and its supporting cast) and prove them out on a throwaway demo page, not
rebuild `/users` itself — that move to real data is phase 4 below.

### New shared components (`src/shared/components/`)

- **`DataTable.jsx`** — the one reusable list view. A real `<table>` above 720px
  (`useIsCompact`/`COMPACT_QUERY`), stacked `<li class="dt-card">` cards below it, same columns and
  actions either way. Column shape: `{ key, header, render(row), sortable, align, primary,
  hideCompact }` (`primary` picks the card title in compact mode, default the first column).
  Set-based selection with select-all scoped to the *visible* rows (porting the rule the phase-0
  audit flagged as worth keeping from the old `Users.jsx`), a sort toggle that calls back
  `{ key, order }` so a caller can hand it straight to `useQueryState`, and an `EmptyState` when
  `rows` is empty. Deliberately **not** wrapped in a `.table-scroll` horizontal-scroll container —
  cells wrap (`word-break: break-word`, no `white-space: nowrap` except the header labels) so the
  table itself adapts instead of scrolling. Worked out on paper for 360/768/1024/1440px (see
  "Verified / not verified"): the header-label-driven minimum width is well under the content width
  at every breakpoint once the sidebar collapses to a drawer below 1024px.
- **`Charts.jsx`** — `BarChart`, `LineChart`, `DonutChart`, all hand-written SVG (no charting
  library, per the master prompt). `BarChart`/`DonutChart` are the two components that used to live
  inline in `Dashboard.jsx` (the phase-0 audit's "move into `shared/components/Chart*`" note);
  `LineChart` is new — a single `<path>` polyline plus a filled area, `preserveAspectRatio="none"`
  over a fixed viewBox so it stretches responsively without JS measuring.
- **`StatCard.jsx`** — the KPI tile `Dashboard.jsx` used to type out as a raw `.stat` div five times;
  now one component with an optional icon and trend line.
- **`Tabs.jsx`** — a real `role="tablist"` with `aria-selected`, roving `tabIndex` and arrow/Home/End
  key handling. Fixes the phase-0 audit's "`.chips` are plain buttons, not a tablist" finding for
  any page that adopts it; the `/users` rebuild (phase 4) is the first real consumer.
- **`Pager.jsx`** — renders the `pages`/`hasPrev`/`hasNext`/`label` shape `usePagination()` already
  computed. There was no pager *component* yet — the old `Users.jsx` table foot was static text
  ("Rows per page: 10") printed over every row, another phase-0 finding.
- `shared/components/index.js` barrel updated with all five.

### Dashboard wired to the shared versions

`features/dashboard/pages/Dashboard.jsx` now imports `BarChart`/`DonutChart` from `Charts.jsx` and
renders `StatCard` for its five tiles, instead of the local copies it carried since phase 1. No
visual change intended; this just removes the duplication the new components made pointless to
keep.

### CSS (`src/index.css`)

Added `.dt-*` (table + cards + sort affordance), `.tabs`/`.tab`, `.pager-*`, `.stat-card-*`/
`.stat-trend`, `.line-chart*`, `.donut-legend` — all built from the existing tokens, no new hex or
pixel literal. Corrected a stale comment over the phone breakpoint that still said "tables scroll
until the DataTable lands in phase 2".

### Demo page — dev-only, temporary

`shared/dev/ComponentsDemo.jsx`, routed at `/_dev/components` only when `import.meta.env.DEV`
(`App.jsx` builds the route behind `env.isDev`, so it doesn't exist in a production `Routes` tree —
Vite still emits the lazy chunk on disk since the `import()` is statically analyzable, but nothing
reachable loads it). Generates 24 synthetic users in local state — deliberately **not** read through
`core/data/api`, so it says nothing about the real user shape the phase-4 reshape still has to do —
and exercises all five new components plus the existing `ConfirmDialog` (typed `DELETE`),
`EmptyState`, `Toast`, and `useQueryState`/`usePagination` together: role tabs synced to `?tab=`,
sortable name/role/joined columns synced to `?sort=&order=`, a 6-row pager synced to `?page=`, a
header "Delete selected" action gated on the selection, row-level `View` actions that just toast
(there is no detail page yet). Deleted in phase 4 along with its dev-only route, now that `/users`
covers the same ground for real.

---

## Phase 4 — done

Scope: rebuild the Dashboard against the master prompt's section-5 spec, rebuild `/users` on
`DataTable` with the real filter set, build `/users/:id`, and finish removing the
pending/approve/block/unblock code the phase-0 audit flagged (phase 1 removed the pending/approval
flow and the per-row block/unblock links; this phase removes the header-level `Block`/`Unblock`
actions and the `Blocked` status itself).

### User mock reshaped (phase-0 audit, section 6)

`core/data/mock/mockData.js`'s `mockUsers` is now generated (20 students, 8 instructors) with
`{ id, name, email, role, course, year, section, department, status, joinedAt, lastActiveAt }` —
students carry `course`/`year`/`section`, instructors carry `department` (and `null` for the other
three), `status` is `'Active' | 'Inactive'` only, and both dates are ISO strings formatted at render
time through `core/logic/format.js`. `composeSection` (`core/logic/validation.js`, shared with
mobile) turns a student's three fields back into `"BSIT 3-A"` wherever the UI needs one string.
`mockStats` gained `classes`; new exports `mockCourseDistribution` (sums to `stats.students`, so the
KPI tile and the course chart agree) and `mockAiUsage` feed the new dashboard charts;
`mockSystemHealth` gained `database` and `queue`; `mockActivity` is a small generic feed (not derived
from the user list) standing in for events across users, content, AI and security until those
domains have real mock data of their own.

### Block/unblock/pending removed end to end

- `mockBackend.js`: `blockUsers`/`unblockUsers` deleted, `loginLock` untouched (that is login
  throttling, unrelated). Added `getUser(id)` (404s via `fail()` if the id is gone) returning the
  profile plus deterministic, id-seeded `classes`/`activity`/`aiUsage` — there is no `/classes` mock
  yet, so a user's classes are generated from their course/department rather than looked up.
- `http/httpBackend.js`: same two methods removed (it already had `getUser` written, unused until
  now).
- `api.js`: `blockUsers`/`unblockUsers` exports removed, `getUser` added.
- `shared/components/ui.jsx`: `Blocked: 'badge-red'` removed from `STATUS_CLASS` — nothing produces
  that status any more.
- `docs/api-contract.md`: the `blockUsers`/`unblockUsers` endpoint row removed; `getUsers`/`getUser`
  rows and the example payload updated to the new shape and to `Active`/`Inactive` only.

### `/users` rebuilt (`features/users/pages/Users.jsx`)

- New `features/users/data/usersRepository.js` — `getUsers`/`getUser`/`deleteUsers`, the only module
  the page calls (master prompt section 6: per-feature repositories in front of `core/data/api`).
- `Tabs` (All/Students/Instructors) plus a filter bar (`course`/`year`/`section`/`department`/
  `status`, each a plain `<select class="input">`, and a search box) drive one `useQueryState`
  (`tab`, `page`, `sort`, `order`, `q`, and the five filters), so the whole list view is bookmarkable
  and survives a reload. Filters and the tab reset the page to 1; sort does not.
- `DataTable` renders the real columns (name/email, role, course-or-department, status, joined, last
  active — all sortable except the compound course/department column), with set-based row selection
  and a `Pager` wired to `usePagination`.
- Row actions are exactly **View** (`/users/:id`), **Export** (a one-row CSV), and **Delete**; the
  header has a filtered-rows **Export CSV** and a selection-gated bulk **Delete (n)**. Both delete
  paths share one `ConfirmDialog` (typed `DELETE`) — `deleteIds` holds whichever id list is pending,
  whether it came from one row or the selection.
- Loading/empty/error/success states via `useAsync` + `SkeletonTable`/`EmptyState`, matching every
  other rebuilt page.

### `/users/:id` built (`features/users/pages/UserDetail.jsx`)

Profile card (avatar, role/status/course-or-department badges, joined date, last-active), an
enrolled-or-owned classes list (`dt-cards` reused outside `DataTable` for a simple card list),
a two-column activity timeline and AI-usage mini-stats, and a danger zone with its own `ConfirmDialog`
(typed `DELETE`) that deletes the account and returns to `/users`. `PageHeader`'s `back` and
`breadcrumbOverrides={{ current: user.name }}` are used exactly as `navigation.js`'s own doc comment
suggested.

### Dashboard rebuilt against master-prompt section 5 (`features/dashboard/pages/Dashboard.jsx`)

Six KPI tiles (added **Classes**), a registrations **trend** (switched the existing `BarChart` to
the phase-3 `LineChart`, since "trend" is literally what that component was built for), **users by
role** (`DonutChart`, unchanged) and **users by course** (new, `BarChart` over
`mockCourseDistribution`), **AI usage by feature** (new, `BarChart` over `mockAiUsage`), a **storage
meter** (the existing `.meter` CSS, previously only used by Settings' password-strength bar), an
expanded **system health** list (added `database`/`queue` — `Badge`'s existing `STATUS_CLASS` already
had `Online`/`Operational`/`Degraded`/`Down`, so no new badge tones were needed), a **recent activity
feed** (`.feed`, replacing the old "recent registrations" table with a generic icon-per-type list),
and **quick links** (new, four `Link`s into Users/Announcements/Security/Settings). The old
`link-danger` "Delete Users" card action from the phase-0 audit's finding 4.1.7 is gone — it no
longer exists because the whole "Recent registrations" card it lived on does not either.

### CSS (`src/index.css`)

Added `.stat-grid-6`/`.stat-grid-2`, `.filters` (the Users filter bar), `.feed`/`.feed-item`/
`.feed-icon`/`.feed-text`/`.feed-time`, `.quick-links`/`.quick-link`/`.quick-link-icon`,
`.profile-card`/`.profile-meta`/`.profile-badges`, `.timeline`/`.timeline-dot`, `.danger-zone` — all
from existing tokens. Extended the 1400/720/400px breakpoints to cover `.stat-grid-6` alongside the
existing stat-grid variants, and added phone-width stacking for `.filters` and `.profile-card`.
`.two-col` (previously undefined at any breakpoint) now collapses to one column at ≤1024px, which
also benefits Settings' existing two-column field pairs.

### Removed

`shared/dev/ComponentsDemo.jsx` and its `env.isDev`-gated `/_dev/components` route in `App.jsx` — see
"demo page" under phase 3. Nothing else imported it.

---

## Phase 5 — done

Scope: `/classes` + `/classes/:id`, `/content`, `/assessments`, `/announcements`, and their mocks,
modelled on `studia-mobile`'s instructor types (`InstructorClass`, `ClassStudent`, `Material`,
`InstructorAssignment`, `Quiz`/`QuizQuestion`, `Announcement` — phase-0 audit, appendix). Routes,
nav entries and lazy imports already existed from phase 1 (`ComingSoon` placeholders); this phase
replaced the five placeholder files with real pages and built the data underneath them.

### Mock data reshaped (`core/data/mock/mockData.js`)

`mockClasses` is generated from the real `mockUsers` — one class per (course, year) combination
(16 total), each assigned a real instructor by department (`DEPARTMENT_OF_COURSE`, new in
`core/logic/validation.js`: BSIT→IT, BEED→ED, BSBA-FM→FM, BSBA-OM→OM) and a real roster
(`studentIds`, filtered from `mockUsers` by matching course/year). `mockMaterials`,
`mockAssignments`, `mockQuizzes` and `mockClassAnnouncements` are all generated per class from that
same list, so every cross-reference (a class's instructor, a class's roster, a material's owner) is
real data, not a separately invented table. `mockSystemAnnouncements` is the seed for the platform-
wide notices `/announcements` manages — a different table from a class's own announcements (see
decision below).

### `classesForUser` replaces the old synthetic `classesFor` (`mockBackend.js`)

Phase 4's `getUser` generated a user's classes from a fixed title list keyed only by the user's id
(decision 14 in that phase, flagged there as temporary). Now that `mockClasses` exists,
`classesForUser(user, classes)` filters the real table by `instructorId` or membership in
`studentIds`, so a user's profile page and a class's roster can never disagree — the reconciliation
phase 4 flagged as this phase's first job is done.

### `/classes` and `/classes/:id`

- `features/classes/data/classesRepository.js` → `getClasses`/`getClass`/`deleteClasses`.
- `Classes.jsx` is `Users.jsx`'s pattern applied to classes: `DataTable` + `useQueryState`
  (course/status filters, search, sort, page) + one `ConfirmDialog` (typed `DELETE`) shared by the
  bulk and per-row delete paths. Columns: class (title + code), instructor, section, student count,
  join code, archived/active status. No add or update — classes come from the mobile app.
- `ClassDetail.jsx`: an info card (code, instructor, section, student count, join code, status,
  created date, via a new `.detail-grid` CSS rule — an auto-fit grid, since this card has more
  fields than the two-column `.two-col` pattern fits), then four read-only `dt-cards` lists
  (roster, materials, assignments, announcements) and a danger zone. Deleting cascades to that
  class's materials, assignments, quizzes and announcements in the mock, matching what the real
  backend must also do (documented in `docs/api-contract.md`).

### `/content`

`features/content/data/contentRepository.js` → `getContent`/`deleteContent`. `Content.jsx` lists
every material across every class — kind, processing status (reusing `Material.processing`'s
three-state vocabulary, and the `Ready`/`Processing`/`Failed` badge tones that already existed from
phase 0's audit recommendation), owner, size (`formatBytes`), posted date. Filters: kind, status,
search. Row action is **Open class** (a link to `/classes/:id`, since there is no material detail
page in the brief) plus **Delete**; bulk delete via selection, same `ConfirmDialog` pattern.

### `/assessments`

`features/assessments/data/assessmentsRepository.js` → `getAssessments` (one call, not paginated —
this is a campus-wide overview, not a per-row CRUD list, so it does not need `useQueryState`/
`usePagination`). `Assessments.jsx`: four `StatCard`s (total quizzes, AI-generated %, total
assignments, average submission rate), a `Tabs` switch between a quizzes `DataTable` (source,
status, Bloom level, difficulty, submission rate) and an assignments `DataTable` (due date, points,
late-submission policy). Pure oversight — no create, edit or delete, matching the brief ("quizzes
and assignments overview") exactly.

### `/announcements` — the one create-capable page

`features/announcements/data/announcementsRepository.js` → `getAnnouncements`/
`createAnnouncement`/`deleteAnnouncements`. `Announcements.jsx` is `Users.jsx`'s list pattern
(filters, `DataTable`, bulk/row delete) plus a create flow that is new to this app: a `Modal` form
(title, message, audience — all/students/instructors/by-course — with a course picker that only
appears for the course audience, and a `Toggle` + `datetime-local` input for "schedule for later").
Validated on the client (`validate()` in the page: required fields, `LIMITS.announcementTitle`/
`announcementBody` — two new entries in `core/logic/validation.js`'s `LIMITS` — and a future-time
check for scheduling) and re-validated in `mockBackend.createAnnouncement` (title/body non-empty,
course required for a course audience — not the scheduling-is-in-the-future check, see assumptions),
matching the "the client is never the authority" rule. This is the first real use of the
`useMutation` hook (written in phase 1, unused until now) — a genuine write-with-validation case,
unlike the delete flows, which keep the same local busy/toast pattern every other delete uses for
consistency.

### CSS (`src/index.css`) and badges (`shared/components/ui.jsx`)

Two new rules: `.detail-grid` (an auto-fit info grid for `ClassDetail`) and `.field-error` (inline
per-field validation text — the create-announcement form is the first page with its own field-level
errors; everywhere else either has none, like most read-only pages, or uses a single banner, like
the login page's `.form-error`). `STATUS_CLASS` gained `Archived`, `Published`, `Scheduled`, `Draft`
tones so `<Badge>` auto-colors every new status word the way it already did for `Active`/`Inactive`.
No new hex values or pixel literals — both rules are built from existing tokens.

### Removed

Nothing removed this phase — phases 1–4 already finished every removal item from the master prompt.

---

## Phase 6 — done

Scope, narrowed from the original "Phase 6 — Intelligence and System" plan: `/ai`, `/reports` and
`/notifications` only. `/security` (+4 sub-pages), `/settings` (+9 sub-pages) and `/help` move to
phase 7 — see "Next phase" below.

### Mock data and backend (`core/data/mock/`, `core/data/http/`, `core/data/api.js`)

- `mockData.js`: exports `BLOOM_LEVELS`/`DIFFICULTIES` (previously phase-5-local consts) so the mock
  backend can aggregate AI-generated quizzes by both without a second copy of either list. New:
  `mockAiRequestsTrend` (its November total equals `mockStats.aiRequests`, the same agreement trick
  phase 4 used for `mockCourseDistribution`/`mockStats.students`), `mockAiFeatureHealth` (latency/
  error rate per feature), `mockAiQuota`, `mockNotifications` (10 rows, 3 unread — the same number
  the old static `mockNavCounts.unreadNotifications` used to hard-code), `mockUserGrowth`,
  `mockEngagementTrend`, `mockParticipationByCourse`, `mockContentConsumption`,
  `mockStrugglingConcepts`. `mockSettings` gained an `ai` block (`{ summarizer, planner,
  quizSynthesizer, chat }`) — the single source `/ai`'s toggles read and write today, and
  `/settings/ai` will read from unchanged next phase.
- `mockNavCounts` no longer carries a static `unreadNotifications` — `getNavCounts` now computes it
  as `notifications.filter(n => !n.read).length` over the same table `getNotifications` lists, so
  the sidebar badge and the inbox can never disagree (see decision 22).
- `mockBackend.js`: `getAiHealth` (derives the transcription-queue and quiz-generation breakdowns
  from the real `materials`/`quizzes` tables rather than inventing parallel numbers — the "aggregate
  from there" instruction phase 5's handoff left for this phase), `updateAiFeature`, `getReports`,
  `getNotifications` (list conventions, filter `read`), `markNotificationRead`,
  `markAllNotificationsRead`. `httpBackend.js` got the matching real-endpoint twin for every one of
  these; `api.js` exports all seven.
- `docs/api-contract.md`: new "Intelligence and the admin inbox (phase 6)" section; the
  `getNavCounts` row now documents the derived-count rule.

### `/ai` (`features/ai/`)

`AiHealth.jsx` (page) + `components/FeatureToggles.jsx` + `logic/constants.js` (`FEATURE_LABELS` —
pulled into its own file after oxlint's `react(only-export-components)` flagged co-exporting a
constant from a component file). Four KPI tiles (requests this month, avg. latency, avg. error
rate, quota used), a requests-over-time `LineChart` and a requests-by-feature `BarChart` (reusing
the dashboard's `usageByFeature` data so the two pages agree), a transcription-queue card (`queued`
count plus a `dt-cards` list of failures — reused outside `DataTable`, the same pattern `ClassDetail`
already established for simple card lists), an AI-generated-quizzes card with two small `BarChart`s
(by Bloom level, by difficulty), a feature-switches card (`Toggle` per feature, optimistic via
`setData` with rollback on a failed `updateAiFeature`, toast either way) and a quota/cost card
(reusing the `.meter` CSS from the dashboard's storage meter).

### `/reports` (`features/reports/`)

`Reports.jsx` only — no sub-components needed, the four tabs (`Tabs`, URL state not needed since
nothing here is linkable to a specific row) each render a chart plus a small table. Engagement
(weekly-active `LineChart`, participation-by-course `BarChart`), Content (views-by-type `BarChart`
plus a tiny `DataTable`), Struggling concepts (a `DataTable`, the one tab that is just a table),
User growth (a new-students `BarChart` plus a `DataTable` with both the student and instructor
columns, since the chart component has no stacked/grouped-series mode — see decision 23). One
"Export CSV" button calls a per-tab exporter from the `EXPORTERS` map, and one "Print view" button
calls `window.print()` against new `@media print` rules in `index.css` (hide the sidebar, topbar,
tabs, pager and page actions; let `.card` break across pages cleanly).

### `/notifications` (`features/notifications/`)

`Notifications.jsx`: an All/Unread `Tabs` filter, a `DataTable` (one column merges the type icon,
title, "Unread" badge and a truncated message; `type` as its own badge; `when` sortable), a header
"Mark all as read" action, and a per-row "Mark read"/"Mark unread" toggle action. No delete — the
brief only asks for mark-read on this inbox.

### New shared utilities

- `shared/utils/csv.js` — `downloadCsv(filename, headers, rows)`, extracted from a local
  `exportCsv()` that `Users.jsx` had carried since phase 4 (decision 24). `Users.jsx` now calls the
  shared version; `Reports.jsx` is the second consumer.
- `shared/components/Icon.jsx` — added `Printer`, for the Reports print-view button. No icon in the
  existing set fit; every other new icon need this phase (transcription/quiz icons) was already
  covered by `Alert`/`Info`/`Shield`/`Chart`.

### CSS (`src/index.css`)

Added `.notif-row` (icon + text layout, reusing the existing `.feed-icon` look), `.toggle-list`/
`.toggle-row`/`.toggle-row-text` (the AI feature-switches list), `.stat-grid-4` (and added it to the
three `.stat-grid` responsive breakpoints alongside `-5`/`-6`, for `/ai`'s four-tile KPI row), and a
new `@media print` block. No new hex values or pixel literals.

### Removed

Nothing removed this phase.

---

## Phase 7 — done

Scope: `/security` + its four sub-pages, the `/settings` hub replacing the pre-phase-1 monolith
(`Settings.jsx`, still 300 lines of three concerns before this phase) plus its nine sub-pages, and
`/help`. All of it was scaffolding (`ComingSoon`) going in.

### Mock data and backend (`core/data/mock/`, `core/data/http/`, `core/data/api.js`)

- `mockData.js`: `mockSettings` gained three new sections — `securityPolicy` (`minPasswordLength`,
  `requireUppercase/Number/Symbol`, `sessionTimeoutMinutes`, `maxLoginAttempts`, `lockoutMinutes`,
  seeded from the same defaults as `studia-mobile`'s `auth-service.ts`) and `uploads` (`allowedTypes`,
  `maxVideoSizeMb`, `maxDocumentSizeMb`, `storageQuotaGb`). `terms` (a bare string) became `legal: {
  terms, privacy }` — the brief asks for a terms **and privacy** text editor, and nothing outside the
  old monolith (now rewritten) read the old shape. `backup` changed from one display string
  (`'Nov 16, 2026 · 2:00 AM · 1.8 GB'`) to real data — `lastBackupAt` (ISO), `lastBackupSizeLabel`,
  and a `restorePoints` array — fixing the phase-0 audit's "a display string masquerading as data"
  finding for this field. `ai` gained `language` and `dailyRequestLimit`, siblings of the existing
  toggle booleans in the same object `/ai`'s `FeatureToggles` already reads and writes.
- New mock tables: `mockAuditLog` (16 seed rows), `mockSessions` (4, one `current`),
  `mockLoginAttempts` (14 seed rows — the mock backend appends a real one on every `login` call from
  here on), `mockVulnerabilities` (8 static findings covering every category the brief names:
  dependencies, password policy, OTP policy, rate limiting, HTTPS, CSP, backup age, file uploads).
- `mockBackend.js`: a new `logAudit(store, action, summary)` helper, called from every write this
  surface performs — `deleteUsers`, `deleteClasses`, `deleteContent`, `deleteAnnouncements`,
  `createAnnouncement`, `updateAiFeature`, `saveSettings`, `runBackup`, `updatePassword`, and
  `revokeSession` — not just deletes (see decision 25). `login()` now also appends a row to
  `loginAttempts` on every call (success, failure, or lockout) and reads `maxLoginAttempts`/
  `lockoutMinutes` from `settings.securityPolicy` instead of the hardcoded `LOGIN_MAX_FAILS`/
  `LOGIN_LOCK_MS` constants (falling back to them if settings are somehow missing) — so
  `/settings/security-policy` is a real control, not a label (see decision 26). `updatePassword` now
  calls `isStrongPassword()` instead of a bare `length < 8` check (phase-0 audit finding 7.3). New:
  `getAuditLog`, `getSessions`, `revokeSession`, `getLoginAttempts`, `getVulnerabilities`.
  `httpBackend.js` got the matching real-endpoint twin for each; `api.js` exports all five.
  `docs/api-contract.md` gained a "Security center (phase 7)" section and extended the
  `getSettings`/`saveSettings`/`runBackup`/`updatePassword` rows for the new shapes.

### `core/config/navigation.js`

Added `icon` to every `/security/*` and `/settings/*` child entry (there was previously only one
icon per top-level item), and a new `childrenFor(path)` export — `NAV_PAGES.filter(p => p.parentPath
=== path)`. Both hub pages below render their card grid from this instead of a second, hand-written
list of labels/descriptions/icons, so adding a tenth settings tab or a fifth security tab is still a
one-file change (master prompt, section 8).

### `/security` (`features/security/`)

- `data/securityRepository.js` → `getAuditLog`/`getSessions`/`revokeSession`/`getLoginAttempts`/
  `getVulnerabilities`.
- `SecurityCenter.jsx` (hub): four `StatCard`s (active sessions, failed logins, posture findings,
  high-severity count) from one `Promise.all` of the four sub-resources, then a `childrenFor`-driven
  `.hub-grid` of cards linking to the four sub-pages.
- `AuditLog.jsx`: filters by actor (via search), action (a `<select>` of five categories — delete/
  create/update/settings/security, each a `Badge` with its own `tone`), and a from/to date range
  (`applyListParams`'s `match` hook handles the two non-equality filters). `DataTable` + `Pager` +
  "Export CSV". Read-only, as the brief asks.
- `Sessions.jsx`: `DataTable` of the (small, unpaginated) session list; every row but the current one
  gets a "Revoke" action through one `ConfirmDialog` (no typed-word gate — revoking a session is
  reversible by signing in again, unlike a permanent delete).
- `LoginAttempts.jsx`: an All/Success/Failed/Locked `Tabs` filter plus search, `DataTable` + `Pager`.
  Read-only.
- `Vulnerabilities.jsx`: not a `DataTable` — a `.dt-cards` list (the pattern `ClassDetail` established
  for a simple card list outside `DataTable`) sorted Critical→Low, each card showing the category,
  title, a `Badge` (severity words were already in `STATUS_CLASS` from an earlier phase — no new
  badge tone needed), the description and a "Recommended fix" line. No actions — read-only, from the
  API once it exists.

### `/settings` (`features/settings/`)

- `data/settingsRepository.js` → `getSettings`/`saveSettings`/`runBackup`/`sendOtp`/`verifyOtp`/
  `updatePassword`. Deliberately does **not** re-export AI toggle calls — `/settings/ai` imports
  `updateAiFeature` straight from `features/ai/data/aiRepository` (see decision 27).
- `hooks/useSettings.js`: one hook (`useAsync` + `useMutation` underneath) every sub-page shares —
  `{ settings, error, loading, reload, save, saving, setSettings }`. `setSettings` is exposed for the
  two pages (`AiSettings`, `Backup`) that need to patch local state from a side-channel write
  (`updateAiFeature`, `runBackup`) rather than through `save`.
- `Settings.jsx` (hub): the same `childrenFor`-driven `.hub-grid` pattern as `SecurityCenter`, no stat
  tiles — the brief only asks for a card hub here.
- The nine sub-pages (`Term`, `EmailOtp`, `SecurityPolicy`, `Uploads`, `AiSettings`,
  `SystemSettings`, `Backup`, `Legal`, `Account`) all follow one shape: the default-exported page
  owns loading/error/`useSettings()`, and renders an inner `*Form` component **only once `settings`
  has loaded**, passing that slice as `initial`. The inner component seeds a local `useState(initial)`
  directly — no `useEffect` to sync it in after the fact (see decision 28; this is the same trick the
  pre-phase-7 `Settings.jsx` already used in `TermAndEmailCard`, just named and repeated on purpose
  nine times instead of invented fresh).
  - `Term.jsx`: school year/semester/start/end, with the existing "end after start" check.
  - `EmailOtp.jsx`: sender email (validated with `isEmail`), OTP expiry, resend interval, a
    require-OTP `Toggle`.
  - `SecurityPolicy.jsx`: minimum length, three `Toggle`s (uppercase/number/symbol), session timeout,
    max attempts, lockout minutes — the one settings page whose values the mock backend's `login()`
    actually reads live (decision 26).
  - `Uploads.jsx`: a `.chips` multi-select for allowed extensions, three number fields for the size/
    quota limits.
  - `AiSettings.jsx`: reuses `FeatureToggles` and `aiRepo.updateAiFeature` verbatim for the switches
    (decision 27); language and daily-limit are a separate, locally-buffered form saved through
    `useSettings().save`.
  - `SystemSettings.jsx`: maintenance-mode `Toggle` (this one actually calls `save` immediately on
    change, since a single switch has no separate "form" to batch), version/up-to-date display, a
    "Check for updates" button that is intentionally a no-op toast — there is no update server yet.
  - `Backup.jsx`: last-backup card + "Back up now" (`runBackup`, patches local state via
    `setSettings`) + a read-only `restorePoints` list rendered as `dt-cards`. No restore action — the
    brief only asks for the list (decision 29).
  - `Legal.jsx`: two plain `<textarea>`s (terms, privacy), one "Publish policy" button. No
    `dangerouslySetInnerHTML`, per the house rule restated in section 7 of the master prompt.
  - `Account.jsx`: the biggest page — admin profile, the same six-box auto-advancing OTP flow the
    phase-0 audit called out as worth porting, and a password step that now shows all five
    `PASSWORD_RULES` as a live checklist (`Icon.Check`/`Icon.Close` per rule) instead of the old
    4-point `strength()` meter that unlocked "Update password" at a score of 2/4 — phase-0 audit
    finding 7.3, finally fixed. The submit button is disabled until every rule passes, the two
    password fields match, and the OTP has verified.

### `/help` (`features/help/`)

`Help.jsx`: a static six-item admin guide (`.guide-list`, a new tiny definition-list style) and an
"About STUDIA" card that reads `settings.system.appVersion` through `settingsRepository.getSettings()`
so the version string can't drift from `/settings/system`'s. No repository file — the one read it
does is a one-line call, not worth a wrapper module for a page this static.

### CSS (`src/index.css`)

Added `.hub-grid`/`.hub-card` (the two hub pages' card grid, with a breakpoint collapse at 1400px to
two columns and 720px to one, alongside the existing `.settings-grid`/`.two-col` rules),
`.rule-list`/`.rule-item`/`.rule-icon` (the password checklist), `.finding-head`/`.finding-category`/
`.finding-fix` (vulnerability cards), `.guide-list` (the Help page). No new hex value or pixel literal
— all built from existing tokens, matching every prior phase.

### Removed

Nothing removed this phase — the legacy `Settings.jsx` was rewritten in place (same file path, which
is also the hub route per `navigation.js`), not deleted-and-recreated.

## Phase 8 — done

Hardening. No new pages and no new dependency; this phase measured what the previous seven
asserted, and fixed what the measurements turned up. Three repeatable checks were added under
`studia-admin/scripts/` so none of it can quietly regress (see `scripts/README.md`).

### Contrast — the big one (`src/theme.js`, `src/index.css`)

Every colour pair the stylesheet actually renders was measured against WCAG AA, not eyeballed.
**24 of 53 text pairs were below 4.5:1**, including most of the status vocabulary the portal leans
on: `.badge-green` 2.78:1, `.badge-red` 2.99:1, `.btn-orange` 2.55:1, `.btn-red` and `.toast-err`
3.82:1, the green "rule met" ticks and the `.stat-trend` arrows 3.25:1, the caps-lock hint on the
glass login card **1.94:1**, and `.nav-group-label` in the sidebar 3.87:1.

The fix keeps the palette: the existing hues stay for fills, tints, charts and the mascot, and
seven darker **ink/strong tokens** were added for text, icons and solid buttons —
`--green-ink #27734A`, `--red-ink #A83B3B`, `--orange-ink #8F5220`, `--blue-ink #2B61BA`,
`--green-strong #2B7F52`, `--red-strong #C24444`, `--orange-strong #A75F25`. `--muted` moved
`#6B7280 → #616775` (it failed on `--surface` and `--lavender-soft`, the two backgrounds it is most
often on), and `.nav-group-label`'s lavender went from 62% to 80% opacity.

Non-text contrast (WCAG 1.4.11, a 3:1 bar) was failing too and is now fixed: input, ghost-button,
pager and OTP borders moved from `--border` (1.2:1 — effectively invisible) to a new
`--border-strong #8B89A3` (3.38:1 on white, 3.11:1 on the page), and the toggle grew an inset ring
so its off state has a perceivable boundary instead of pale lavender on white.

`node scripts/check-contrast.mjs` now reports **55 of 55 pairs passing**.

### Other accessibility fixes

- **`Modal` had no focus management at all** (`shared/components/ui.jsx`). It now remembers what
  opened it, moves focus inside on open, traps Tab and Shift+Tab, and restores focus on close. A
  dialog can nominate its landing control with `data-autofocus` — used by `IdleWarning`, so Enter
  on the warning keeps you signed in instead of logging you out. `ConfirmDialog` lost its own
  focus effect; `Modal` owns focus now, and still lands on the "type DELETE" box when there is one.
  `aria-describedby` is wired to the description.
- **The sidebar user menu was mouse-only.** Opening it now moves focus to the first item, Up/Down
  cycle, Home/End jump, Escape closes it and returns focus to the button. The `<aside>` and the
  `<nav>` inside it no longer share one label ("Portal navigation" / "Main navigation"), and a dead
  `aria-hidden={undefined}` attribute is gone.
- **`DataTable` sort state was invisible to a screen reader.** Sortable `<th>`s now carry
  `aria-sort="ascending|descending|none"` and each sort button says what pressing it will do
  ("Joined, sort descending"); the chevron is `aria-hidden`.
- **Tabs had `role="tab"` with nothing to control.** `Tabs` takes a `controls` id, and the five
  pages that use it mark their results container `role="tabpanel"` + `aria-labelledby`. `Card`
  forwards extra props so this needed no wrapper elements.
- **Error toasts did not exist.** `Toast` accepts `kind`, but no page ever passed it — every
  failure, including `setToast(e.message)` in a catch block, rendered as a purple success. Added
  `shared/hooks/useToast.js` (`showToast` / `showError`) and migrated all 18 pages that toast;
  failures are now red and announced with `role="alert"` + `aria-live="assertive"`, successes stay
  `role="status"` + polite.
- **404 and 403 had no `<h1>`.** `EmptyState` takes `headingLevel`; the two error pages pass 1, so
  every route has exactly one `<h1>`.
- The storage and AI-quota meters are `role="progressbar"` with `aria-valuenow/min/max`.

### Layout bug found while auditing

Stacked `<Card>`s had **no separation at all** on `/dashboard`, `/classes/:id`, `/users/:id`,
`/ai` and `/reports`: `.card` has no margin, and those pages render their blocks as siblings of a
fragment, so the cards butted together. Fixed with one rule — `.page-transition > * + * { margin-top:
var(--space-3); }`. Adjacent margins collapse, so blocks that already set a bigger margin
(`.page-header`, `.stat-grid`, `.tabs`) keep theirs, and no page needed a wrapper. `/reports`'
content and growth tabs now also wrap their two cards in `.stack`, which doubles as the tabpanel.

### Images and bundle

The ~4.1 MB of PNGs the phase-0 audit flagged were still full-size seven phases later: two
2000×2000 logos and a 2000×2000 mascot, displayed at 38–140 CSS px. Resized in place to twice their
largest rendered size (logos 96×96, mascot 320×320) with high-quality bicubic resampling, alpha
preserved:

| | before | after |
|---|---|---|
| `studia-mascot.png` | 1,951 KB | 76 KB |
| `studia-logo.png` | 1,035 KB | 17 KB |
| `omsu-logo.png` | 966 KB | 16 KB |
| **whole `dist/`** | **~4.8 MB** | **768 KB** |

JS is unchanged and healthy: one chunk per route (0.6–8.7 kB each), a 285 kB shared `index` chunk
(91 kB gzipped), 49 kB `jsx-runtime`. A `VITE_USE_MOCK=false` build drops to 267 kB, which is the
mock backend tree-shaking out as designed.

### Reliability and the lint net

`no-undef` is now on in `.oxlintrc.json` (with `env: { browser, es2024 }`, and a `node` override for
`scripts/**`). This is not cosmetic: the toast migration above removed a `react` import that was
still needed, and `npm run build` was perfectly happy to ship it — Vite does not resolve
identifiers, so the page would have thrown `useState is not defined` at runtime. The rule catches
that class of bug; it was verified by deleting an import on purpose and watching lint fail.

`features/users/pages/Users.jsx` was 286 lines, over the ~250 bar; its filter bar moved to
`features/users/components/UserFilters.jsx`. Every component is now under 250 lines.

### States and copy audit

Every page was checked for the four states the brief asks for. All 25 pages that load data render a
skeleton while loading, an `EmptyState tone="error"` with a "Try again" button on failure, an empty
state with the mascot when a list comes back empty, and a toast on success. The four that load
nothing are static by design (the `/settings` hub, which is a card grid built from `navigation.js`,
`/help`, and the 404/403 pages); `/login` has its own form-level error, lockout and loading states
instead.

Copy: toast messages are all past tense and end in a period; confirmations all read
"<verb> this <thing>?"; pending buttons all use the same "Saving… / Posting… / Publishing…" shape.
Two inconsistencies were fixed — the typographic apostrophes in `Login.jsx`/`Account.jsx` now match
the straight ones used everywhere else, and the password-mismatch message was two different
sentences in two places (inline field error vs toast) and is now one.

### Checks added (`studia-admin/scripts/`)

Plain `node`, no dependency, no server, non-zero exit on failure. `_load.mjs` copies `src/core` to a
temp directory with extensionless imports resolved and `import.meta.env` replaced, so Node can
import the app's own modules; nothing under `src/` is touched. Deliberately not wired into
`package.json` — Vite 8 ships rolldown rather than esbuild, this project has no test runner, and
phase 8 added no dependency.

- `check-contrast.mjs` — 55 colour pairs, read from `theme.js` so it cannot drift.
- `check-routes.mjs` — all 29 routes titled, described (20–160 chars), breadcrumbed and mounted;
  titles unique; the three pages outside `<Layout>` set their own title.
- `check-api.mjs` — **91 assertions over 33 api functions**, and it verified several things earlier
  phases only claimed: filtering/sorting/paging actually apply; `getUsers` returns only
  `Active`/`Inactive`; deleting a class really does take its materials out of `/content`; the
  unread badge drops on read and zeroes on "mark all"; `/ai` and `/settings/ai` genuinely share one
  object; deletes land in the audit log; a wrong password does not reveal which half was wrong;
  `dashboard.stats.totalUsers` equals students + instructors.

### Demo-removal invariant — re-verified

Deleted `demoCredentials.js`, built with `VITE_USE_MOCK=false`: build clean, and `Studia@2026` and
the demo label appear nowhere in `dist/`. The only trace is the glob key string
`"./demoCredentials.js"` next to an empty module map — no credential. File restored, rebuilt clean.

### Docs

`docs/api-contract.md`: the admin section's headings lost their phase labels (the surface is
complete, and build order is noise to whoever writes the PHP), a line states the surface is closed
(one create endpoint, five deletes, everything else reads), and **Known gaps** is split into Mobile
and Admin. The admin gaps now name the real conflict found this phase: the admin UI requires
`@omsu.edu.ph`, mobile's `auth-validation.ts` enforces no domain at all, and mobile's seeded demo
accounts are `@omsc.edu.ph` — three sources, three answers. The server has to pick one.

## Decisions

1. **One gateway, two backends.** `core/data/api.js` keeps its role as the only module the UI may
   call; the mock/HTTP choice lives there. Per-feature repositories
   (`features/users/data/usersRepository.js`…) arrive with each feature's phase and will import
   from `api.js`, so no component ever learns which backend is live.
2. **The mock switch is compared against the raw env value** in `api.js` and `demo.js`
   (`import.meta.env.VITE_USE_MOCK !== 'false'`) rather than through `env.useMock`, because Vite
   inlines the literal and can then tree-shake the mock backend and the demo credentials out of a
   `VITE_USE_MOCK=false` build. Verified: a non-mock build contains no copy of the admin password,
   a mock build contains two. The rule is exactly "mock unless the value is the string `false`",
   and `env.js` uses the same comparison so the three cannot drift.
3. **Token in memory, marker in `localStorage`.** Documented in `docs/api-contract.md` with the
   httpOnly-cookie upgrade path. Consequence to keep in mind: with a real API, a hard reload has no
   token until a refresh endpoint exists.
4. **Drawer and user menu close by deriving from the pathname** (they remember which page they were
   opened on) instead of a `setState` inside a navigation effect. Back and Forward close them too,
   and it keeps the lint rule about state-in-effects satisfied honestly rather than silenced.
5. **Scaffolding is visible, not fake.** Unbuilt routes render `ComingSoon` with the real header, so
   navigation, breadcrumbs, titles and transitions are testable now and no page pretends to work.
6. **Pages not in the brief:** none added yet. `/403` was already required; nothing else seemed
   missing before the feature pages exist.
7. **Login lockout lives in the mock, not just the UI.** The brief asks for "throttling UI", but a
   counter that only the client enforces is not a real control. `mockBackend.login` keeps
   `fails`/`lockedUntil` in its in-memory db and actually rejects attempts during the lock window
   (429), so the UI is reflecting real state, not performing security theatre. `ApiError.meta` is
   explicitly documented as display-only so nobody later treats it as authoritative over
   `status`/`code`.
8. **Glassmorphism is one card, not a two-pane layout.** Rejected keeping the old hero/panel split
   and just blurring the panel — a single full-bleed background with one centered glass card both
   matches "frosted card over the photo" more literally and removes the phone-width hero-hiding bug
   for free, rather than patching the old layout's responsive behavior.
9. **`DataTable` cards wrap instead of scrolling, on purpose.** The old `.table-scroll` pattern
   satisfies "works on a phone" but not "no horizontal scroll" — the brief's phrasing for the new
   table. `DataTable`'s wide layout drops `white-space: nowrap` from cells (only the header labels
   keep it) and relies on `table-layout: auto` sizing columns to the nowrap header width, which is
   smaller than the content width at every required breakpoint once the sidebar is a drawer. Below
   720px it does not render a `<table>` at all.
10. **The demo page is not wired to `core/data/api` or the real mock users.** Phase 4 still has to
    reshape the user mock (course/year/section/department instead of one free-text `section`
    field — see the phase-0 audit, section 6). Pointing the demo at today's shape would make it look
    like that reshape already happened. Synthetic local data keeps the two concerns separate.
11. **Sorting lives in the caller, not `DataTable`.** The component only tracks which column/
    direction is active and reports `{ key, order }` back; it never sorts `rows` itself. That keeps
    it usable for both a client-side sort (the demo page) and a server-shaped `sort`/`order` query
    param (the real `/users` rebuild) without a prop to tell it which mode it's in.
12. **"Inactive" replaces "Blocked" with no admin-facing toggle.** The phase-0 audit flagged that
    prompt item 4 (keep Block/Unblock as header buttons) and item 5 (status is Active/Inactive only)
    contradict each other. This phase resolves it the other way from the phase-0 recommendation:
    rather than making Block *set* Inactive, the admin side drops block/unblock entirely — "Admin can
    read and delete only" (master prompt, item 5) reads as the stronger, later instruction once the
    pending flow was already gone. Whatever makes an account inactive happens in the mobile app or
    the backend, not from this dashboard.
13. **One `ConfirmDialog` instance serves both single-row and bulk delete.** `Users.jsx` keeps one
    `deleteIds` array (`null` when closed) instead of separate dialogs/handlers for "delete this row"
    and "delete the selection" — both paths just set the array to one id or many, so the confirm copy,
    the typed-`DELETE` gate and the API call are written once.
14. **A user's classes/activity/AI-usage are generated server-side (mock), not stored.**
    `/classes` and its mock do not exist yet, so `mockBackend.getUser` derives a plausible
    `classes`/`activity`/`aiUsage` payload from the user's own fields (id, course/department,
    joinedAt/lastActiveAt) rather than inventing a second, disconnected mock table that phase 5's real
    classes mock would then have to reconcile with.
15. **Dashboard KPI totals and the Users-list row count intentionally disagree**, continuing the
    original mock's own pattern (`mockStats.totalUsers` was always 1284 while `mockUsers` only ever
    had a handful of rows). `mockStats`/`mockCourseDistribution`/`mockAiUsage` model a plausible
    full-campus scale for the dashboard charts; `mockUsers` (28 rows) is what `/users` actually lists
    and paginates. A real backend would make both queries against the same `users` table, so this gap
    closes itself once `VITE_USE_MOCK=false`.
16. **Unlike decision 15, a class's `studentCount` is never a separately invented number — it is
    always `roster.length`.** `mockClasses.studentIds` is computed once, from the real `mockUsers`
    list, and both `getClasses` (the count column) and `getClass` (the roster) derive from the same
    array. This phase had the chance to fix the "profile vs. roster" mismatch decision 14 left open
    (see "`classesForUser` replaces..." above) and took it, rather than repeating the dashboard-vs-
    list pattern a second time for a relationship that is easy to keep consistent.
17. **Classes are generated one per (course, year) combination (16 total), not one per section.**
    The brief's filters (course/year/section/department) are about *users*, not classes; Classes
    doesn't need the full course×year×section cross-product to exercise every UI state (empty
    roster, archived, search, sort, pagination). Fewer, real classes with occasionally-empty rosters
    (some course/year pairs have no matching students in the 20-student mock) is more honest than
    padding the count — and an empty roster is a real state worth being able to see.
18. **Deleting a class cascades in the mock** (materials, assignments, quizzes, that class's own
    announcements) **rather than leaving orphaned rows**, because `/content` lists materials across
    every class — an orphaned material pointing at a deleted class would be a dangling reference the
    UI has no way to resolve. The real backend must do the same cascade (documented in
    `docs/api-contract.md`'s `deleteClasses` row) or enforce it with a foreign key.
19. **Two different "announcements" tables, not one.** A class's own announcements (instructor-
    authored, shown read-only inside `ClassDetail`, mirroring mobile's `Announcement` type exactly:
    `classId`, `title`, `body`, `postedAt`, `pinned`) are a different thing from the platform-wide
    notices `/announcements` manages (admin-authored, with `audience`/`course`/`status`/
    `scheduledAt`/`publishedAt` — no `classId`, no `pinned`, no comments). Collapsing them into one
    shape would force one of the two screens to carry fields that make no sense for it. The master
    prompt's wording ("platform announcements... the only area where admin may create content") is
    specifically about the second table; the first is read-only oversight, same as materials or
    assignments.
20. **Assessments has no pagination or `useQueryState`**, unlike every other list page this phase and
    last. The brief calls it an "overview," `getAssessments` returns the whole quiz/assignment list
    in one call (campus-wide, not per-class), and there is no filter, sort or delete action specified
    for it — so there is nothing for a URL-synced query state to hold. Adding one would be
    scaffolding with no behavior behind it.
21. **Quiz `source` and announcement/content `status` values are capitalized strings** (`'AI'`,
    `'Manual'`, `'Ready'`, `'Scheduled'`, `'Published'`), matching the existing `'Active'`/`'Inactive'`
    convention from phase 4 rather than the lowercase `'ai'`/`'manual'` mobile's own `Quiz.source`
    type uses — `<Badge>` derives its color from the exact child string via `STATUS_CLASS`, so this
    app's convention is capitalized words throughout. `audience` on a system announcement stays
    lowercase (`'all'`/`'students'`/`'instructors'`/`'course'`) because it is a selector value compared
    against `AUDIENCE_LABELS`, never shown raw or passed to `Badge`.
22. **`unreadNotifications` is a derived count, not a stored field.** The static
    `mockNavCounts.unreadNotifications: 3` from phases 1–5 is gone; `getNavCounts` now counts unread
    rows in the same `notifications` table `getNotifications` lists. The alternative — a counter the
    mock increments/decrements alongside `markNotificationRead` — is exactly the kind of
    two-places-to-update state that caused the pending-flow mess phases 1–4 spent their time removing.
23. **`BarChart`/`LineChart` stay single-series; `/reports`' growth tab pairs a chart with a table
    instead of a stacked/grouped-bar mode.** Both chart components are intentionally small
    (`shared/components/Charts.jsx`, per the master prompt's "prefer hand-written SVG" instruction),
    and every other page's data is already single-series. Adding a second series mode for one tab on
    one page would grow a shared component for a single caller; the `DataTable` beneath the chart
    already shows the full students/instructors breakdown per month.
24. **`downloadCsv` moved to `shared/utils/csv.js` instead of writing a second copy for `/reports`.**
    `Users.jsx` had carried a local `exportCsv()` since phase 4; this phase needed the same Blob/`<a
    download>` logic for a second, unrelated page, which is the point past which "reuse existing
    components before writing new ones" (house rules) means extracting, not copy-pasting again.
    `Users.jsx` was refactored to call the shared version so there is exactly one implementation.
25. **`logAudit` is called from every write this surface performs, not just deletes.** The master
    prompt's wording ("every delete is shown in the audit log") is a floor, not a ceiling, and
    "audit log" normally means every write. Left out on purpose: the `login` call itself — that has
    its own, more detailed table (`getLoginAttempts`), and duplicating every sign-in into the audit
    log too would make the one table whose job is "every admin write" noisy with an event that isn't
    a write to app data.
26. **`/settings/security-policy` is wired into the mock's actual lockout behavior**, not just a form
    that writes to a settings object nothing reads. `mockBackend.login()` reads `maxLoginAttempts`/
    `lockoutMinutes` from `store.settings.securityPolicy` (falling back to the `LOGIN_MAX_FAILS`/
    `LOGIN_LOCK_MS` constants if a settings object is somehow missing) instead of the hardcoded
    constants phase 2 introduced. Continues the same philosophy as decision 7 (login lockout lives in
    the mock, not just the UI) one step further: the *limits* now live in one editable place too.
27. **`/settings/ai`'s toggles call `aiRepo.updateAiFeature` directly; `settingsRepository.js` does
    not re-export it.** The alternative — wrapping the same call behind a second repository function
    — adds a layer that does nothing but rename the import, and an extra indirection is exactly the
    kind of thing that invites a future edit to "fix" one copy and not the other. Phase 6's
    `FeatureToggles` component is reused as-is, passed the live `settings.ai` object as its
    `toggles` prop.
28. **Every `/settings/*` sub-page splits into an outer page (owns `useSettings()`, loading/error)
    and an inner `*Form` component that seeds `useState(initial)` directly, rendered only once
    `settings` is non-null** — rather than a single component with a `useEffect` that calls
    `setForm(settings.x)` once data arrives. The latter is what the pre-phase-7 `Settings.jsx`'s
    `TermAndEmailCard` *avoided* (it already split this way) but the OTP/password `ProfileCard` in
    that same file did not need to, since it only read `settings` for display. Writing six new pages
    the effect-based way first tripped oxlint's `react(set-state-in-effect)` rule on every one of
    them; splitting them the other way, matching the pattern already proven in this codebase, cleared
    every warning and needed no `eslint-disable`.
29. **`/settings/backup` has no restore action, only a read-only restore-point list.** The brief says
    "last backup, restore points and manual runs" — it asks to see the list, not to act on it, and a
    "Restore" button with no real backend behind it would be exactly the "misleading affordance" the
    phase-0 audit flagged for the old dashboard's `link-danger` "Delete Users" link. If a real restore
    flow is wanted later, it is a new confirm-gated mutation on top of this list, not a rework of it.

30. **New "ink" tokens rather than a darker palette.** The contrast failures could have been fixed
    by darkening `--green`/`--red`/`--orange` outright, but those tokens also paint chart series,
    tints and meter fills, where the lighter hue is correct and the 4.5:1 bar does not apply. Adding
    `--green-ink`/`--red-ink`/`--orange-ink`/`--blue-ink` for text and `*-strong` for solid buttons
    keeps STUDIA looking like STUDIA while every *readable* pair clears AA. The house rule that
    follows: text takes an ink token, fills take the hue.
31. **`--border-strong` is a deliberate visual change.** Input and ghost-button borders at
    `--border` (1.2:1) are effectively invisible, which WCAG 1.4.11 treats as a failure rather than
    a style choice. The new value is the lightest purple-grey that still clears 3:1 on both white
    and `--surface`, so fields look a little more defined than before and no more than they must.
32. **One `useToast` hook instead of a `kind` argument per page.** Eighteen pages each held
    `useState('')` plus a `clearToast` callback, and not one of them ever passed `kind`, so every
    failure rendered as a success. Giving each page a second state variable would have invited the
    same omission again; a hook with two verbs (`showToast`, `showError`) makes the failure path
    the easy one to write.
33. **`no-undef` is on in oxlint.** Vite builds happily with an identifier that does not exist —
    the toast migration proved it, producing a page whose `useState` import had been removed. A
    build that passes is not evidence the app runs; this rule is the cheapest thing that is. The
    `scripts/**` override gives those files `node` globals instead of browser ones.
34. **Images were resized, not converted to WebP/AVIF.** This environment has no WebP encoder
    (no sharp, no ImageMagick, no ffmpeg, no Python/Pillow), and pulling in `sharp` — a large
    native dependency — to save perhaps another 30% on 110 kB of PNG fails the brief's "a tiny
    dependency only if you justify it". Resizing to twice the rendered size already removed 97% of
    the weight. The full-resolution originals stay in git history (`git show HEAD:…`) if a larger
    rendering is ever needed.
35. **The checks are plain `node` scripts, not an npm script or a test runner.** Vite 8 ships
    rolldown, so there is no esbuild to lean on, and adding a runner (or a bundler) for three files
    would be the first dependency in eight phases. `scripts/_load.mjs` is ~40 lines and lets Node
    import the app's own ESM directly; `scripts/README.md` says how to run them and what each one
    protects.
36. **Page rhythm is one CSS rule, not a wrapper per page.** Five pages were rendering stacked
    cards with no gap at all. Wrapping each page's content in a `.stack` would have worked and
    would have had to be remembered on every future page; `.page-transition > * + *` applies to
    whatever a page renders, and margin collapsing leaves blocks that already carry a larger margin
    untouched.

## Assumptions

- `/api/admin/...` is the base path, matching `backend/src/Modules/Admin`. Endpoint shapes are in
  `docs/api-contract.md` (section "Admin (web)").
- `GET /api/admin/nav-counts` is a new, cheap endpoint invented for the sidebar badges.
- The mobile `COURSES`, `YEARS`, `SECTIONS`, `DEPARTMENTS` lists and the `"BSIT 3-A"` section format
  are authoritative; the admin reuses them rather than defining its own.
- The admin enforces `@omsu.edu.ph` (`core/logic/validation.js`), following the master prompt.
  **Phase 8 confirmed this is a real three-way conflict**: mobile's `auth-validation.ts` applies no
  domain rule at all, and its seeded demo accounts are `@omsc.edu.ph`, which the admin's rule would
  reject. Written up as admin gap 1 in `docs/api-contract.md`; the server has to pick one and the
  two clients then follow it. Not fixable from here — `studia-mobile/` is out of bounds.
- The idle timeout is 20 minutes with a 60-second warning, from `VITE_SESSION_IDLE_MINUTES`.
- A user's classes, activity timeline and AI-usage numbers on `/users/:id` are illustrative mock
  data generated from the user's own record (see decision 14); phase 5 resolved the classes part of
  this (decision/section above) by reading from the real `mockClasses` table. `activity` and
  `aiUsage` are still per-user synthetic numbers — no mock table for a raw event log or AI-request
  log exists yet, so there is nothing real to read them from. Phase 6's `/ai` and `/notifications`
  pages may want one, at which point `getUser`'s `activity` could read from it the same way its
  `classes` now reads from `mockClasses`.
- `GET /api/admin/assessments` is assumed to be one uncached read of the full campus-wide quiz and
  assignment overview, not a paginated list — see decision 20. If the real dataset turns out too
  large for one response, this is the endpoint to add paging to first, and `Assessments.jsx` is the
  one list page in the app without `useQueryState` wired up for it already.
- A system announcement's `scheduledAt` must be in the future: enforced on the client
  (`Announcements.jsx`'s `validate()`) but **not** re-checked in `mockBackend.createAnnouncement`,
  unlike every other field. The real backend must add this check — flagged here rather than silently
  left out of `docs/api-contract.md`, where the `createAnnouncement` row says what the mock does and
  does not re-validate.
- `getReports`' `strugglingConcepts` is a placeholder shape (`concept`/`course`/`avgScorePct`/
  `studentsAffected`) rather than a real aggregation, because no mock models a quiz concept/topic
  tag yet — `mockQuizzes`/`mockClasses` have no such field. Flagged in `docs/api-contract.md`'s new
  phase-6 section so the real query is written against an actual concept tag once one exists, not
  against this standalone list.
- `UserDetail`'s and `Dashboard`'s per-user `activity`/`aiUsage` numbers (decision 14, phase 5's
  handoff note) are **still** synthetic, generated from the user's own id — this phase's
  `mockNotifications` and AI-usage mocks are deliberately separate tables (an admin inbox and a
  campus-wide usage summary are not a per-user event log), so there was nothing here to reconcile
  them against. Carried forward again; a real per-user activity log is still the fix.
- `getVulnerabilities` is a static list, not a real scan. The master prompt says so explicitly
  ("Findings come from the API; use mock data now") — a real implementation runs an actual dependency
  audit, policy comparison, TLS/CSP probe and backup-age check on a schedule, and this endpoint reads
  the latest run. Flagged in `docs/api-contract.md` too.
- A login attempt recorded by the mock always uses the IP `127.0.0.1 (this device)`, since the mock
  runs entirely in the admin's own browser and has no real client IP to read. The seed rows in
  `mockLoginAttempts` use varied, illustrative IPs so the filter/search UI has something realistic to
  exercise; only the backend can ever know the admin's real IP.
- `getAuditLog`'s `actor` is always `"OMSU Administrator"` today, since there is exactly one admin
  account (master prompt, section 2). The column is real (not hardcoded in the UI) so it costs
  nothing if that ever changes.

## Verified / not verified

- Verified (phase 1): `npm run lint` (0 warnings), `npm run build`, 27 assertions over
  `navigation.js`, `mappers.js`, `validation.js` and `format.js`.
- Verified (phase 2): `npm run lint`, `npm run build`; rebuilt with `demoCredentials.js` deleted and
  `VITE_USE_MOCK=false` — clean build — then `grep`ped the built `dist/assets/*.js` for the demo
  password string and found none; restored the file and rebuilt clean again.
- Verified (phase 3): `npm run lint` (0 warnings) and `npm run build`, both after every edit in this
  phase, including after wiring `Dashboard.jsx` to the new `Charts`/`StatCard`.
- **Not verified (phase 3):** same gap as phases 1–2 — no browser tool in this session, so
  `/_dev/components` was never actually opened before it was deleted in phase 4. The "no horizontal
  scroll at 360/768/1024/1440" requirement was satisfied by *design reasoning* only (decision 9: the
  table's nowrap-driven minimum width is comfortably under the content width at every breakpoint).
  `/users` now exercises the same `DataTable` for real — verify it there instead (see below).
- Verified (phase 4): `npm run lint` (0 errors, 0 warnings) and `npm run build`, both after every
  edit. Also confirmed with `curl` against `npm run dev` that `/`, and the raw
  `Users.jsx`/`UserDetail.jsx`/`Dashboard.jsx` module URLs, all transform and serve without a Vite
  error overlay.
- **Not verified (phase 4):** no browser tool was available in this session, so nothing was opened
  and clicked through. Still to do, first thing next session, with `npm run dev` while signed in:
  open `/dashboard` and `/users` at 360/768/1024/1440px and confirm the KPI grid, the two-column
  chart rows and the Users filter bar all reflow without a horizontal scrollbar, and that `/users`'
  table switches to `dt-cards` at ≤720px with all three row actions present on each card; exercise
  the Tabs (arrow/Home/End), change every filter and the search box and confirm `?tab=/?course=/
  ?year=/?section=/?department=/?status=/?q=/?sort=/?order=/?page=` update in the URL and the table
  refetches; delete one row and then a multi-row selection through the shared `ConfirmDialog`,
  typing `DELETE`, and confirm the `Toast` fires and the row(s) disappear; open `/users/:id` for both
  a student and an instructor and check the course/department badge, the classes list, the timeline
  and the AI-usage tiles render, then delete from the danger zone and confirm it lands back on
  `/users`. Then repeat the still-outstanding phase-1/2/3 unverified items (login glass card,
  caps-lock, lockout countdown, reduced motion, sidebar drawer, user menu).
- Verified (phase 5): `npx oxlint` (0 errors, 0 warnings — the `react(purity)` warning about calling
  `new Date()` inline in `CreateAnnouncementModal.jsx`'s JSX was fixed by computing it once in a
  lazy `useState` initializer instead) and `npm run build`, both after every edit. Also confirmed
  with `curl` against `npm run dev` that `/` and the five new page module URLs
  (`Classes.jsx`/`ClassDetail.jsx`/`Content.jsx`/`Assessments.jsx`/`Announcements.jsx`, plus the
  reshaped `mockBackend.js`/`mockData.js`) all transform and serve without a Vite error overlay.
- **Not verified (phase 5):** no browser tool was available in this session, so nothing was opened
  and clicked through. Still to do, first thing next session, with `npm run dev` while signed in, on
  top of the still-outstanding phase-1–4 items above: open `/classes`, `/content` and
  `/announcements` at 360/768/1024/1440px and confirm their filter bars and `DataTable`s reflow and
  switch to `dt-cards` the same way `/users` already does; open a `/classes/:id` for a class with an
  empty roster (several course/year pairs have none, by design — decision 17) and one with students,
  and check every `dt-cards` section (roster/materials/assignments/announcements) and the danger
  zone; delete a class and confirm the cascade (its materials disappear from `/content` too); open
  `/assessments` and switch the Quizzes/Assignments tabs with arrow keys; open `/announcements`,
  create one of each audience (all/students/instructors/by-course) and both schedule modes (now and
  future), confirm client-side validation messages (`.field-error`) show for an empty title/body and
  for a past schedule time, and confirm the new row's status (`Scheduled` vs `Published`) and `When`
  column match what was chosen; delete one and a multi-row selection through the shared
  `ConfirmDialog`.
- Verified (phase 6): `npm run lint` (0 errors, 0 warnings — one `react(only-export-components)`
  warning on `FeatureToggles.jsx` was fixed by moving `FEATURE_LABELS` to its own `logic/
  constants.js`, same pattern as `features/announcements/logic/constants.js`) and `npm run build`,
  both after every edit. Also confirmed with `curl` against `npm run dev` that `/` and every new
  module (`AiHealth.jsx`, `Reports.jsx`, `Notifications.jsx`, `FeatureToggles.jsx`, the reshaped
  `mockBackend.js`) transform and serve without a Vite error overlay.
- **Not verified (phase 6):** same recurring gap — no browser tool in this session. Still to do,
  first thing next session, with `npm run dev` while signed in, on top of the still-outstanding
  phase-1–5 items above: open `/ai`, `/reports` and `/notifications` at 360/768/1024/1440px; on `/ai`,
  flip each feature switch and confirm the optimistic toggle sticks (and rolls back if you simulate a
  failure), and confirm the four-tile KPI row and both chart rows reflow without a horizontal
  scrollbar; on `/reports`, switch all four tabs, confirm "Export CSV" downloads the right columns
  for whichever tab is active, and confirm "Print view" (`window.print()`) hides the sidebar/topbar/
  tabs/pager in the print preview and lets `.card`s break cleanly across pages; on `/notifications`,
  switch All/Unread, mark one row read and one back to unread, click "Mark all as read" and confirm
  the sidebar's unread badge count drops to match (reload the page if it doesn't — the badge count is
  fetched once per `Layout` mount, not re-polled, so a same-session live update is not expected; note
  whether that gap is worth fixing before phase 7's `/security` audit log needs the same kind of
  live count).
- Verified (phase 7): `npx oxlint` (0 errors, 0 warnings — six pages initially tripped
  `react(set-state-in-effect)` with a `useEffect(() => setForm(settings.x), [settings])` pattern;
  fixed by splitting each into an outer page and an inner `*Form` rendered only once `settings` is
  loaded, seeding `useState(initial)` directly — decision 28) and `npm run build` (every new page is
  still its own chunk; see the file list in the build output), both after every edit. Also confirmed
  with `curl` against `npm run dev` that `/` and all sixteen new/rewritten page modules
  (`SecurityCenter`/`AuditLog`/`Sessions`/`LoginAttempts`/`Vulnerabilities`, the nine `/settings/*`
  pages, `Help.jsx`), plus the reshaped `mockBackend.js`/`mockData.js`, transform and serve without a
  Vite error overlay.
- **Not verified (phase 7):** same recurring gap — no browser tool in this session. Still to do,
  first thing next session, with `npm run dev` while signed in, on top of the still-outstanding
  phase-1–6 items above:
  - `/security`: open the hub and confirm the four `StatCard`s and the `childrenFor`-driven card grid
    both render; on `/security/audit-log`, trigger a few of the actions that call `logAudit` (delete a
    user, toggle an AI feature, save a settings page, change the admin password) and confirm each
    shows up at the top of the list with the right `action` badge; exercise the action filter and the
    from/to date range together with search; confirm "Export CSV" downloads the filtered rows. On
    `/security/sessions`, revoke a non-current session and confirm it disappears and the current
    session's row has no revoke action. On `/security/login-attempts`, sign out and try a few wrong
    passwords, then confirm new `Failed`/`Locked` rows appear (and that `/settings/security-policy`'s
    `maxLoginAttempts`/`lockoutMinutes` actually change how many tries it takes — decision 26). On
    `/security/vulnerabilities`, confirm the eight findings sort Critical→Low.
  - `/settings`: open the hub, then each of the nine sub-pages at 360/768/1024/1440px; confirm every
    `Save`/`Publish`/`Back up now` button shows its pending label and a success `Toast`, and that a
    simulated failure shows an error `Toast` without losing the typed form values; on `/settings/ai`,
    flip a toggle and confirm `/ai`'s own toggles reflect the same state after a reload (one source,
    not two); on `/settings/account`, run the OTP flow end to end (send, enter the `devCode`, confirm
    the password-rule checklist ticks off live as you type, confirm the submit button stays disabled
    until every rule passes and the two fields match).
  - `/help`: confirm the version string matches `/settings/system`'s.
  - Repeat the reduced-motion and keyboard-navigation checks (`Tabs` arrow keys on
    `/security/login-attempts`, focus management after the new `back` navigations) that no phase so
    far has actually opened a browser to confirm.

- Verified (phase 8): `npm run lint` (0 errors, 0 warnings, now including `no-undef`) and
  `npm run build` after every edit, plus three new repeatable checks — `scripts/check-contrast.mjs`
  (55/55 pairs at AA), `scripts/check-routes.mjs` (29 routes titled, described, breadcrumbed and
  mounted; titles unique) and `scripts/check-api.mjs` (91 assertions over 33 api functions, which
  closed several phase 4–7 "not verified" items on the *data* side: filtering, sorting, paging, the
  class→materials delete cascade, the unread counter, the single AI-settings source of truth, the
  audit trail, and that a wrong password does not reveal which half was wrong). The demo-removal
  invariant was re-verified end to end. The `no-undef` rule was itself verified by deleting an
  import on purpose and watching lint fail.
- **Not verified (phase 8), and this is now the whole remaining list:** no browser tool exists in
  this session either, so nothing has been *looked at*. What that leaves open is narrower than
  before, because everything measurable has now been measured, but it is still real: the glass blur
  on the login card, actual reflow at 360/768/1024/1440, `DataTable`'s switch to cards at 720 px as
  seen rather than as reasoned, focus order and focus-after-navigation in practice, the modal focus
  trap against the "type DELETE" field, `prefers-reduced-motion`, the drawer and the collapsed
  sidebar, and whether the new ink colours and `--border-strong` still *look* like STUDIA. Phase 9
  is that pass and nothing else — see below.

## Final checklist — master prompt, section 4

Every numbered item in the product owner's notes, with how it was checked. "Code-verified" means
read in the source or asserted by a script; "browser" is the one thing this session could not do.

| # | Requirement | State | Evidence |
|---|---|---|---|
| 1 | Home → Dashboard (`/dashboard`, nav label, title, `Dashboard.jsx`; `/` redirects) | done | `features/dashboard/pages/Dashboard.jsx` is the only file there; `App.jsx` redirects both `/` and the old `/home`; `check-routes.mjs` passes |
| 2 | No search bar on Dashboard/Settings/Users topbar; `GlobalSearch` gone | done | `grep GlobalSearch src/` → nothing; `Topbar.jsx` contains no `<input>`; search lives only inside the lists |
| 3 | Pending/approval flow removed entirely | done | no "pending"/"approve" reference survives except React mutation state and a class roster's "Submitted / Pending" count; `check-api.mjs` asserts every user row is `Active` or `Inactive` |
| 4 | Block/unblock removed from status | done | no block/unblock code anywhere (`grep` matches are `btn-block` and the `.block` utility) |
| 5 | Read and delete only — no add/update for user or academic records | done | `core/data/api.js` exposes reads, five deletes, one create (`createAnnouncement`), and updates only for admin-owned state (settings, AI switches, read flags, own password). Every delete goes through `ConfirmDialog` and requires typing the word |
| 6 | Glassmorphism login | done | code-verified: frosted card over the campus photo + purple gradient, mascot, entrance animation, show/hide password, caps-lock hint, loading state, `role="alert"` errors, lockout countdown. **Visual blur not seen in a browser** |
| 7 | Demo credentials trivially removable, one file, mock-flag gated | done | re-verified this phase: file deleted → `VITE_USE_MOCK=false` build clean, no credential string in `dist/` |
| 8 | Settings as a hub of sub-pages | done | `/settings` hub + nine sub-pages, all from `navigation.js` |
| 9 | Better sidebar: groups, icons, active indicator, collapse, drawer, badges, user menu | done | code-verified; this phase added the keyboard behaviour the menu was missing |
| 10 | Sub-pages and routing for every tab, breadcrumbs, page headers, back | done | 29 routes, `check-routes.mjs` asserts title + description + breadcrumb + mount for each |
| 11 | Smooth transitions, skeletons, no layout jump, reduced motion | done | `PageTransition` + `Skeleton`; `prefers-reduced-motion` handled in CSS and in the scroll behaviour. **Motion not watched in a browser** |
| 12 | Responsive everywhere; every table collapses to cards | done | one `DataTable` switching at 720px via `useIsCompact`; breakpoints at 1400/1024/720/400 and an ultra-wide rule. **Not opened at 360/768/1024/1440 in a browser** |
| 13 | Database-ready | done | single `api.js` gateway, mock/HTTP behind `VITE_USE_MOCK`, `client.js` with timeout/abort/normalized errors/401 redirect, `mappers.js` for snake↔camel, server-shaped list params, `docs/api-contract.md` complete |
| 14 | Security, validation, scalability, reliability, navigation, UI, UX, SEO | done, with two caveats | contrast now 55/55 at AA; CSP/referrer/noindex/`robots.txt`; token in memory; idle timeout + multi-tab logout; route-level code splitting; `no-undef` lint net; 91 API assertions. Caveats: the browser pass below, and the token-persistence gap recorded in the contract |

## Next phase — phase 9 (the browser pass, and then the backend)

Phase 8 closed everything that can be closed without a browser. What is left needs eyes on a
screen, and it is now a much shorter list than the one phase 8 inherited, because the parts that
could be measured have been.

1. **Open it in a browser.** `npm run dev`, sign in, and work through every route at 360, 768,
   1024 and 1440 px. Specifically check what no script can: that the glass login card actually
   blurs (`backdrop-filter` with the `-webkit-` fallback), that nothing scrolls horizontally, that
   `DataTable` really flips to cards below 720 px with all its row actions, that the drawer and the
   collapsed sidebar behave, that focus lands sensibly after each route change, and that
   `prefers-reduced-motion: reduce` kills the animations.
2. **Re-check the fixes this phase made blind.** The new ink colours and the darker input borders
   change how the UI looks, not just how it measures — confirm the badges and buttons still look
   like STUDIA. Confirm the new `.page-transition > * + *` rhythm did not double-space anything
   that already had a margin. Confirm the tabs still read correctly now that their panels carry
   `role="tabpanel"`, and that the modal focus trap does not fight the "type DELETE" field.
3. **Keyboard-only pass**: Tab from the skip link through sidebar → topbar → content → pager;
   arrow keys on every `Tabs`; Escape out of every modal and the user menu; confirm the revoke and
   delete confirmations can be completed without a mouse.
4. **Then the backend.** The UI is finished and `docs/api-contract.md` is complete; the next real
   work is PHP. Switch `VITE_USE_MOCK=false` against the first live endpoint and the only file that
   should need touching is `core/data/http/httpBackend.js`. Settle the email-domain conflict
   (admin gap 1) before writing the validator.

### House rules worth repeating

- Work only on the current phase.
- `navigation.js` first: a new page is a nav entry plus a lazy route.
- No hex, pixel step or duration in a page — use the tokens. Text colour comes from an **ink**
  token, not from `--green`/`--red`/`--orange`, which are fills.
- Every page: `PageHeader`, one `<h1>`, and loading / empty / error / success states.
- Destructive actions go through `ConfirmDialog`; permanent deletes require typing the word.
- Failures toast through `showError`, successes through `showToast` — never one colour for both.
- No `dangerouslySetInnerHTML`, ever.
- Keep components under ~250 lines.
- After a change to the palette, `navigation.js`/`routes.js` or the mock backend, run the matching
  script in `studia-admin/scripts/` alongside `npm run lint` and `npm run build`.
