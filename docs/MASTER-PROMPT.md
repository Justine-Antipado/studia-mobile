MASTER PROMPT

1. Role and scope
You are a senior front-end engineer and UX designer. Build the complete UI of the STUDIA Admin web portal (studia-admin/) for the app below.
Hard boundaries
• Work ONLY inside studia-admin/ (plus docs/ for notes). Do not touch studia-mobile/. Do not build the PHP backend; only make the UI database-ready.
• Keep the existing stack: React 19, Vite 8, react-router-dom 7, oxlint, plain CSS (index.css + CSS variables from theme.js). Do not add a UI framework. A tiny dependency is allowed only if you justify it (for example a chart library; prefer hand-written SVG charts).
• Follow the existing feature-folder structure. Do not invent a new architecture.
2. About the app (use this to decide what the admin needs)
STUDIA Mobile is a mobile-first, AI-driven Learning Management System for Occidental Mindoro State University, Mamburao Campus (OMSU). It works like Google Classroom, with built-in AI for video lesson transcription, instant summaries, smart task management and adaptive quiz generation.
Roles: Student, Instructor, Admin. Admin is a single fixed account that cannot register.
Student: join classes, AI lesson summarizer (bullets, TL;DR, mind map, including videos), AI study planner, automatic to-do list with due dates and checklist, assignments (instructor decides whether late submission is allowed), AI practice quizzes and flashcards with rationale, chat with AI, edit profile, comment on announcements.
Instructor: create, archive and delete classes (auto join code); remove students; upload lessons (PDF, slides, .mp4/.mov) with AI transcript and objectives; AI quiz synthesizer (multiple choice, plus manual identification and essay; difficulty levels; Bloom's taxonomy); assignments; grade and comment; announcements; smart analytics (engagement, content consumption, struggling concepts).
AI core: speech-to-text, automated bullet and concept mapping, Bloom's quiz synthesizer.
Domain data already modeled on mobile (studia-mobile/src/features/*/types): InstructorClass, ClassStudent, Announcement, Material/Lesson, Assignment, Quiz, QuizQuestion, Submission, Task, PlannerBlock, Notification. Course codes: BSIT, BEED, BSBA-FM, BSBA-OM. Years 1 to 4, sections A to E, departments FM, OM, IT, ED. Email domain @omsu.edu.ph. Password rules and 6-digit OTP rules are in studia-mobile/src/features/auth/logic/auth-validation.ts. Reuse the same rules in the admin UI so both apps agree.
3. Existing admin code (read before changing)
• src/App.jsx: routes /login, / (Home), /users, /settings behind ProtectedRoute + Layout.
• src/shared/components/Layout.jsx: sidebar (Home, Users, Settings), topbar with GlobalSearch, mobile drawer.
• src/shared/components/ui.jsx: Avatar, Badge, Toggle, Card, Modal, Toast, Icon.
• src/core/data/api.js: the only file the UI talks to; delegates to core/data/mock/mockBackend.js.
• src/theme.js: palette (primaryDark #3B288C, primary #5B46B6, lavender #D6CEFA, surface #F4F5F9, and so on), pushed to CSS variables. Font: Poppins.
• features/auth (Login, AuthContext, ProtectedRoute), features/dashboard/pages/Home.jsx, features/users/pages/Users.jsx (block, unblock, delete, approve), features/settings/pages/Settings.jsx.
• Each feature already has components/ data/ hooks/ logic/ pages/ index.js folders with READMEs.
Keep the STUDIA purple identity, mascot, OMSU logo and studia logo from src/assets.
4. Required changes (from the product owner's notes)
Removals and renames
1.  Rename Home to Dashboard (route /dashboard, nav label, page title, file Dashboard.jsx). / redirects to /dashboard.
2.  Remove the search bar from Dashboard and Settings (and Users). Search belongs inside tables and lists only, not in the topbar. Remove GlobalSearch from the topbar.
3.  Remove the pending/approval flow entirely: no Pending status, no Approve button, no pending counter or card.
4.  Remove Block and Unblock in the status so that the block and unblock button on the top is the funktional.
5.  Admin can read and delete only. There is no Add or Update for user and academic records, because those are created in the mobile app. The UI must show only the actions that make sense, and destructive ones must be confirmed (section 7).
Additions 6. Glassmorphism login (frosted card over the OMSU campus photo plus the purple gradient, mascot, soft blur, animated entrance, clear focus states, show/hide password, caps-lock hint, loading state, accessible errors). 7. Demo credentials must be trivially removable. Isolate them in ONE file, src/core/config/demoCredentials.js, loaded only when VITE_USE_MOCK=true. The login page shows the demo box only if that flag is on. Deleting that file plus the flag must leave the app compiling. Never hard-code credentials anywhere else. 8. Redesigned Settings as a hub of sub pages (section 5), not one long page. 9. A much better tab bar / sidebar: grouped sections with labels, icons, active indicator, hover and focus states, collapsible on desktop, drawer on mobile, badges for counts, user menu at the bottom with logout. 10. Sub pages and routing for every tab, with nested routes, breadcrumbs, page headers, and back navigation. 11. Smooth transitions between pages and sub pages (fade and slide, skeleton loaders, no layout jump). Respect prefers-reduced-motion. 12. Responsive everywhere (phone, tablet, laptop, ultra-wide). Every table collapses into stacked cards on small screens, with the same actions available. 13. Database-ready (section 6). 14. Security, validation, scalability, reliability, easy navigation, appealing UI, good UX, SEO (section 7).
5. Information architecture (routes and screens)
Sidebar groups and routes. Each page gets loading, empty, error and success states.
Overview
• /dashboard: KPI cards (total users, students, instructors, active today, classes, AI requests), registrations trend chart, users by role and by course donut or bar, AI usage by feature (summarizer, planner, quiz synthesizer, chat), storage meter, system health (server, AI service, database, queue), recent activity feed, quick links.
People
• /users: filter tabs All / Students / Instructors; filters by course, year, section, department, status (Active / Inactive only); column sort; pagination; row actions limited to View, Export, Delete (bulk delete with selection); table turns into cards on mobile.
    ◦ /users/:id: profile, enrolled or owned classes, activity timeline, AI usage, danger zone (delete with confirmation).
Academics (read-only oversight)
• /classes and /classes/:id: all classes, instructor, section, student count, join code, archived flag, roster, materials, assignments, announcements. Admin may delete a class (confirmed).
• /content: materials library (video, PDF, slides), processing status (processing, ready, failed), size, owner; delete allowed.
• /assessments: quizzes and assignments overview, AI-generated vs manual, submission rates.
• /announcements: platform announcements. This is the only area where admin may create content (system-wide notices), with scheduling and audience (all, students, instructors, by course).
Intelligence
• /ai: AI usage and health: requests per feature over time, transcription queue and failures, quiz generation counts by Bloom level and difficulty, average latency, error rate, monthly quota or cost estimate, AI feature on/off switches.
• /reports: analytics and exports (CSV and print view): engagement, content consumption, struggling concepts campus-wide, user growth.
System
• /notifications: admin inbox (failed jobs, storage warnings, security alerts), mark read.
• /security: security center with sub pages
    ◦ /security/audit-log: who did what and when (filter by actor, action, date), exportable, read-only.
    ◦ /security/sessions: active admin sessions with revoke.
    ◦ /security/login-attempts: failed logins, lockouts, IP.
    ◦ /security/vulnerabilities: security posture checklist and scanner-style findings (outdated dependencies, password policy, OTP policy, rate limiting, HTTPS, CSP, backup age, file-upload policy) with severity badges and recommended fixes. Findings come from the API; use mock data now.
• /settings (hub of cards) with sub pages
    ◦ /settings/term: school year, semester, start and end dates.
    ◦ /settings/email-otp: sender email, OTP expiry, resend interval, require OTP for reset.
    ◦ /settings/security-policy: password rules, session timeout, max login attempts, lockout minutes.
    ◦ /settings/uploads: allowed file types (mp4, mov, pdf, slides), max sizes, storage quota.
    ◦ /settings/ai: AI feature toggles, language, limits.
    ◦ /settings/system: maintenance mode, app version, update status.
    ◦ /settings/backup: last backup, run backup, restore point list.
    ◦ /settings/legal: terms and privacy text editor.
    ◦ /settings/account: admin profile, change password with the OTP flow (send, verify, update).
• /help: short admin guide and about STUDIA.
• *: styled 404 page. Add a 403 page too.
If you think a page is missing for this application, add it and list it in docs/admin-progress.md with a one-line reason.
6. Database-ready architecture
• core/data/api.js stays the single gateway. Split it into per-feature repositories (features/users/data/usersRepository.js, and so on) that call a shared core/data/http/client.js.
• http/client.js: base URL from VITE_API_URL, bearer token header, JSON handling, timeout, AbortController support, one normalized error shape { status, code, message, fieldErrors }, automatic redirect to /login on 401, and a hook for refresh tokens.
• .env.example: VITE_API_URL, VITE_USE_MOCK, VITE_APP_NAME, VITE_SESSION_IDLE_MINUTES. A single switch (VITE_USE_MOCK) picks mock or HTTP implementation; the components must not know which one is active.
• Mappers convert API snake_case to UI camelCase in one place.
• Lists use server-side shaped params: page, pageSize, sort, order, q, filters; responses { data, meta: { page, pageSize, total } }.
• Write the endpoint list you assumed into docs/api-contract.md (it already exists; extend it) using REST paths under /api/admin/..., matching the PHP module layout in backend/src/Modules/Admin (Controllers, Services, Repositories, Validators) and tables such as users, otp_codes. Include request and response examples and error codes.
• Reusable hooks: useAsync, useQueryState (URL-synced filters and page), usePagination, useDebounce, useDocumentTitle, useIdleTimeout.
7. Quality bars
Security
• Validate and sanitize every input on the client (length limits, email domain, password rules shared with mobile, 6-digit OTP). Remember the server is the real authority; say so in the API doc.
• Never use dangerouslySetInnerHTML; escape all user content. Render the terms editor as plain text or sanitized markdown.
• Token handling isolated in one module; clear on logout and on 401. Prefer in-memory plus an httpOnly cookie when the backend supports it, and document the choice.
• Login: throttling UI (attempt counter, temporary lockout message), generic error text that does not reveal whether the account exists, no password in URLs or logs.
• Idle timeout with warning modal; multi-tab logout sync.
• Route guards plus a role check (admin only). Destructive actions use a confirm modal; permanent deletes of users or classes require typing the item name or the word DELETE. Every delete is shown in the audit log.
• Add a Content-Security-Policy meta tag in index.html, referrer policy, and noindex, nofollow (this is a private portal).
• No secrets in the repo; .env.example only.
Validation and reliability
• Inline field errors, disabled-while-submitting buttons, optimistic UI only where it can be rolled back, retry on failed loads, error boundary per route, toast feedback, and offline banner.
Scalability
• Route-level code splitting with React.lazy and Suspense; pagination everywhere; memoize heavy lists; no component over about 250 lines; shared primitives in shared/components.
Navigation and UX
• Breadcrumbs, active states, keyboard navigation, focus management after route change, consistent page header (title, subtitle, actions), empty states with the mascot, consistent confirmation and toast language.
Accessibility and SEO
• Semantic landmarks (header, nav, main), one h1 per page, labelled controls, 4.5:1 contrast, visible focus, ARIA for modals, tabs and menus.
• useDocumentTitle sets <title> and meta description per route ("Users · STUDIA Admin"). Proper lang, viewport, favicon, theme-color, Open Graph tags on the login page, robots.txt with Disallow: /.
Responsive tables to cards
• Build one reusable DataTable component that takes column definitions and renders a real table on wide screens and stacked cards (label and value pairs, actions at the bottom) below about 720px. Use it everywhere. Test at 360, 768, 1024 and 1440px widths.
Visual design
• Keep the purple palette; add tokens for spacing, radius, shadow, z-index, motion durations. Light theme required; dark mode optional if time allows. Glass surfaces (blur, translucent white, subtle border) on the login screen and as an accent on the dashboard hero only; keep content areas clean and readable.
8. Target structure to produce
studia-admin/src/
  App.jsx                    # lazy routes, nested routes, 404/403
  core/
    config/ (env.js, demoCredentials.js, routes.js, navigation.js)
    data/ (http/client.js, mock/*, api.js)
    logic/ (validation.js, format.js, mappers.js)
  features/
    auth/ dashboard/ users/ classes/ content/ assessments/
    announcements/ ai/ reports/ notifications/ security/ settings/ help/
    (each: components/ data/ hooks/ logic/ pages/ index.js)
  shared/
    components/ (Layout, Sidebar, Topbar, Breadcrumbs, PageHeader, DataTable,
                 StatCard, Chart*, Modal, ConfirmDialog, Toast, Skeleton,
                 EmptyState, ErrorBoundary, Tabs, Badge, Avatar, Icon)
    hooks/  utils/
navigation.js is the single source for sidebar items, breadcrumbs and page titles, so adding a tab means editing one file.
9. Working rules
1.  Before coding, read the existing files listed in section 3 and the mobile types/ folders, then state your plan in 10 lines or fewer.
2.  Work only on the current phase. Do not start the next one.
3.  Reuse existing components before writing new ones. Delete dead code (pending/approve/block, GlobalSearch).
4.  After each phase: run npm run lint and npm run build, fix everything, open the pages at the four widths, and check keyboard and reduced-motion behavior.
5.  Update docs/admin-progress.md (done, decisions, assumptions, next phase). This file is the handoff to the next chat session, so read it first in every new session.
6.  Finish with a short summary: what changed, how to run it, what is mocked, what the next phase is.
