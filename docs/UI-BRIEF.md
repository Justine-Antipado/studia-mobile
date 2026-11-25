ROLE: Senior React Native engineer (Expo SDK 58, Expo Router, strict TypeScript).

GOAL: Finish the ENTIRE UI of studia-mobile for STUDENT and INSTRUCTOR. UI only, with mock data. Backend/DB integration comes later.



== TOKEN RULES (follow strictly) ==

- First read: CLAUDE.md, AGENTS.md (skip if it doesn't exist), package.json, src/shared/**, src/core/**, src/app/**/_layout.tsx. After that, open files one at a time, only when needed.

- Never print whole files in chat. Use the Edit/Write tools. Do not re-read a file you just edited.

- No long explanations. After each phase, output a summary of at most 10 lines (files added/changed + any blockers).

- Work in PHASES. After each phase run `npx tsc --noEmit` and `npx expo lint`, fix every error, then stop and wait for "next".

- Dependencies: use `npx expo install <pkg>` only, prefer official Expo modules, and install nothing unnecessary. Allowed:

expo-file-system,

@react-native-async-storage/async-storage,

@react-native-community/netinfo,

expo-video, expo-secure-store, expo-image-picker, expo-document-picker, expo-notifications, react-native-svg. List them in P1 before installing. Never edit ios/ or android/.

- Do not ask me questions unless truly blocked. Decide UX/visual details yourself, consistent with the existing design language.



== FILE STRUCTURE (already approved, do NOT reorganize) ==

- Keep the existing structure and naming: src/app (thin route re-exports), src/core, src/features/<feature>/{components,data,hooks,logic,screens,types} + index barrel, src/shared.

- Do not move or rename existing folders or files unless a requirement below needs it (e.g. splitting a file over 250 lines, or moving shared-screens.tsx content in P4).

- New files go into the matching existing folder. Create a new folder only when no existing one fits, and give it a README.md (1-3 lines).

- Update docs/ROUTE-MAP.md whenever routes are added.



== APP CONTEXT (use this to shape UX, copy, and mock data) ==

STUDIA Mobile is a mobile-first, AI-driven Learning Management System for Occidental Mindoro State University – Mamburao Campus. It works like Google Classroom (classes, streams/announcements, materials, assignments, grading), but with native AI for video lesson transcription, instant summarization, smart task management, and adaptive quiz generation, for both students and instructors.



Student features:

- AI Lesson Summarizer: condense lectures/readings (including video) into bullet points, a TL;DR, or a mind map.

- Smart Task & Study Planner: reads deadlines, readings and exam dates, then builds an optimized daily study schedule.

- Interactive Practice Quizzes: AI-generated flashcards and practice quizzes with instant rationale and feedback.



Instructor features:

- Lesson & Material Repository: upload lecture videos (.mp4, .mov), PDFs and slides; AI auto-extracts the transcript and key learning objectives.

- AI Quiz Synthesizer: generate quizzes from any module or video, with difficulty levels.

- Smart Analytics: real-time engagement metrics, content consumption rates, and detection of concepts students struggle with.



AI core (mock behind a single `ai-service` interface, UI must expose all three):

- Speech-to-Text Transcription: show transcript view (timestamps, search, processing/ready/failed states) for every uploaded video.

- Automated Bullet & Concept Mapping: bullets, TL;DR, and a simple mind-map view generated from a lesson/transcript.

- Bloom's Taxonomy Quiz Synthesizer: each generated question is tagged with a Bloom level (Remember, Understand, Apply, Analyze, Evaluate, Create) plus difficulty (Easy/Medium/Hard); instructors can filter and edit before publishing.



Business rules:

- Instructors can create classes; generate/create quizzes; upload lessons and video lessons; remove students, delete classes, grade students and comment on their work; post announcements that students can comment on.

- QUIZ TYPES: the AI Quiz Synthesizer generates Multiple Choice only. Manual quiz creation supports Multiple Choice, Identification, and Essay. Identification and Essay are graded by the instructor.

- Assignments: the instructor chooses whether late submissions are allowed. If not allowed, the student's file stays attached as a draft, and the student can "Turn in" when they reopen it.

- Students get an automatic to-do list (with due dates) as a checklist; they can use AI to summarize lessons (including videos), build their planner, and chat with AI; and they can edit their profile.

- Mock data must use realistic OMSU-Mamburao style content (BSIT/BSED-style course codes like IT 101 and GEd 105, Filipino names, Philippine school calendar, PH time zone, ₱ not needed).



== CURRENT STATE (do not break) ==

- Routes in src/app/ are thin re-exports of features/<feature>/screens/*.

- Already exist: shared/components/ui (screen, app-header, app-button, parts, studia-tab-bar), shared/hooks (use-safe-back, use-responsive), shared/constants/studia-colors (C), features/instructor/data/instructor-store (in-memory), features/auth/data/auth-service (mock), core/data/storage/session-store, core/data/mock/mock-data.

- The student side is much less complete than the instructor side. There is no student store.

- There is no ErrorBoundary. AI/Notifications/Account live in shared-screens.tsx (619 lines) with a `role` prop.

- Keep the existing design language (Poppins, C colors, layout style). Extend it, do not redesign.



== HARD REQUIREMENTS ==

1. RESPONSIVE: use use-responsive (compact <360, tablet >=600). No hard-coded widths/heights. Use flex, maxWidth (MAX_CONTENT_WIDTH), safe-area insets, and fontScale-safe text (numberOfLines, flexShrink). On tablets use centered content or 2 columns where it fits. All forms must be keyboard-safe (KeyboardAvoidingView / ScrollView with keyboardShouldPersistTaps).

2. NO REDUNDANCY: extract repeated UI into shared/components/ui (Card, ListRow, Badge, EmptyState, SectionHeader, Chip, Avatar, ProgressBar, FormField, ConfirmDialog, BottomSheet, Skeleton, Toast, HorizontalChipBar, FilterPillSheet). One source of truth for colors, spacing, radius and typography (tokens). Remove duplicates from existing screens where possible.

3. MAINTAINABLE: max 250 lines per file. Split into each feature's components/ hooks/ logic/ types/. Strict TS, no `any`. Every feature has an index barrel. Update the README of every folder you touch (1-3 lines).

4. ERROR HANDLING: create a shared `ErrorBoundary` (class component with fallback UI, "Try again" and "Go home"). Place it in the root layout and in each role layout, and wrap every screen through the `Screen` component. Also add loading / empty / error states to every list and screen. Use expo-router's `ErrorBoundary` export if SDK-supported (check the docs).

5. DB-READY (mock for now): each feature gets `data/<feature>-repository.ts` with an interface (e.g. `ClassRepository`, `QuizRepository`, `SubmissionRepository`, `TaskRepository`, `AnnouncementRepository`) plus a `mock` implementation. Methods must be async (Promise) and return Result<T,E> or typed errors. Screens only use hooks (`useClasses()`, `useTasks()`, etc.) that return {data, loading, error, refetch, mutate}. Switching to the real API must mean replacing one implementation file per feature. Also add a `core/data/api-client` stub (fetch wrapper: base URL from EXPO_PUBLIC_API_URL, timeout, typed errors, ready for an auth token) but do not use it yet.

6. NAVIGATION / BACK:

   - Every sub-page lives in the correct route group (student/ or instructor/) and is registered in the _layout with `href: null` if it is not a tab.

   - One `useSafeBack(fallback)` is used by every back button and the Android hardware back. The fallback is the LOGICAL parent (e.g. quiz-detail → class-detail → classes), not just home.

   - The highlighted tab stays correct while on a child route (use `also` in the TABS config).

   - Confirm-discard dialog when there are unsaved changes (quiz editor, assignment form, profile edit).

   - No dead ends on deep link / cold start. Guard roles (a student cannot open /instructor/* and vice versa; redirect when there is no session, except the __DEV__ demo fallback).

7. TRANSITIONS: smooth and consistent. Stack: slide_from_right for sub-pages, fade/none for tab switches, slide_from_bottom (modal presentation) for create/upload sheets. Use react-native-reanimated (if already in the SDK deps) for entering/exiting and list item animations, skeleton shimmer and pressable scale feedback. Respect reduce-motion. No layout jumps or flicker after loading.

8. SECURITY / VULNERABILITY (client side):

   - Validate and sanitize all input (trim, max length, type checks) in `logic/` validators. Never render raw HTML; no `dangerouslySetInnerHTML`-style APIs, no eval.

   - No secrets or tokens in code or logs; remove console.log of sensitive data. Use `expo-secure-store` for token/session persistence (not AsyncStorage).

   - Upload validation: whitelist of mime types/extensions (.mp4, .mov, .pdf, .ppt/.pptx, .docx, images), max size, sanitized file names, clear error messages.

   - Validate URL/deep-link params (id format) before use. Never trust route params.

   - Role-based UI guards, plus a comment noting that real authorization belongs on the backend.

   - Prevent double-submit (loading lock on buttons). Confirm dialogs on destructive actions.

   - Run `npx expo-doctor` and `npm audit --omit=dev`; report high-severity findings, do not force-fix.

9. CACHING (client-side, mock now, real API later):

   - Create `core/data/cache/` with a `QueryCache` (key → {data, fetchedAt, staleAt}). Hooks like useClasses()/useTasks() read through it: return cached data instantly, then revalidate in the background if stale (stale-while-revalidate). Default TTL by data type (e.g. static lists 5 min, announcements/notifications 30 s, AI results until the source changes).

   - Dedupe in-flight requests (same key = one call). Cache keys are built by one helper, never hand-typed strings.

   - Invalidate by key/prefix when a mutation succeeds (e.g. posting an announcement invalidates ['class', id, 'stream']). Support optimistic updates with automatic rollback on failure.

   - Persistence goes behind a `CacheStore` interface (in-memory implementation now; AsyncStorage implementation allowed via `npx expo install @react-native-async-storage/async-storage`). Only non-sensitive, non-token data is persisted. Clear the whole cache and store on logout and on role/user switch.

   - Cache AI outputs (summaries, transcripts, generated quizzes) keyed by source id + options, so the same request is never regenerated. Provide a "Regenerate" action that bypasses the cache.

   - Images: use expo-image with cachePolicy="memory-disk" and placeholders. Never use RN's Image for remote URLs.

9b. UI / ASSET CACHING (only where it measurably helps; do not over-optimize):

   - IMAGES: all remote images (avatars, class covers, thumbnails) use expo-image with cachePolicy="memory-disk", a `placeholder` (blurhash or solid C color), `transition` (fade), and `recyclingKey` inside lists. Create ONE shared `AppImage` component in shared/components/ui that wraps this, so no screen uses expo-image or RN Image directly. Fixed sizes via aspectRatio/contentFit, never layout jumps. Prefetch (Image.prefetch) the next screen's likely images (e.g. class covers after the courses list loads). Provide `clearImageCache()` and call it on logout.

   - LOCAL ASSETS: logo, mascot, and icons are required statically (never fetched). Preload fonts (Poppins) and critical images during the splash screen, then hide the splash only when ready (no font flicker).

   - ICONS: import only the icon sets/families actually used; use one shared `Icon` component so icon names are typed and centralized.

   - VIDEO / FILES: video thumbnails are cached through AppImage. Downloaded or previewed files go in the app cache directory (expo-file-system cacheDirectory), with a max size/age and an eviction helper. Never cache videos in memory. Add a "Clear cache" button in Account > Privacy & Security that clears QueryCache, image cache, and downloaded files, and shows the freed size.

   - COMPONENT MEMOIZATION (apply selectively, not everywhere): React.memo for list row/card components; useMemo only for expensive derived data (sorting/filtering/grouping tasks, planner schedule, gradebook rows, analytics aggregates); useCallback only for handlers passed to memoized children. Do not wrap trivial components.

   - STYLES/TOKENS: all styles via StyleSheet.create at module level; responsive styles computed once per breakpoint through a `useResponsiveStyles` helper (memoized by breakpoint/fontScale), not rebuilt on every render.

   - HEAVY VIEWS: cache the computed result of expensive renders (mind map layout, chart paths, planner week grid) with useMemo keyed by their source data, and keep rendered tab screens mounted (lazy: true, freezeOnBlur) so switching tabs does not rebuild or refetch them.

   - TAB/SCREEN STATE: keep scroll position and filter/sort state for tab screens when navigating away and back (state lives in a small per-screen store or in the route params, not in a component that unmounts).

   - Measure before adding more: in P5, check re-renders on the 3 heaviest screens (Home, Course detail, Gradebook) and remove memoization that gave no benefit.

10. EFFICIENCY:

   - Lists use FlatList (or SectionList) with keyExtractor, stable renderItem via useCallback, memoized row components (React.memo), initialNumToRender/windowSize tuned, getItemLayout where rows are fixed-height. Never map() large lists inside a ScrollView.

   - Paginate lists in the repository interface (cursor/limit params; mock it) with onEndReached loading.

   - Debounce search/input-driven queries (300 ms) and cancel stale requests (AbortController).

   - No inline object/array/function props in hot paths; styles via StyleSheet.create. Split context/stores so one change does not re-render the whole app (selector-based subscriptions on the stores).

   - Lazy-load heavy screens/components (video player, mind map, charts) and mount them only when visible. Animations run on the UI thread (Reanimated worklets); avoid JS-driven animation.

   - Do not load full videos/PDFs into memory; stream or reference by URI.

11. RELIABILITY:

   - Normalize all errors into typed AppError {code, message, retryable}. User-facing messages are friendly; no raw stack traces or server text in the UI.

   - Reads: timeout + retry with exponential backoff (max 3, only for retryable errors). Writes: never auto-retry unless idempotent (use an idempotency key in the repository signature for create/submit).

   - Offline: detect connectivity (`npx expo install @react-native-community/netinfo`), show the offline banner, serve cached data, and disable/queue write actions with a clear message instead of failing silently. Re-sync/revalidate when connection returns and when the app returns to foreground (AppState).

   - Uploads: show progress, support cancel and retry, validate before upload, and keep the picked file in a draft state so a failed upload is never lost.

   - Drafts: autosave unsaved forms (quiz editor, assignment form, announcement, submission text) locally, restore on reopen, discard on confirm. Clear on successful submit.

   - Prevent double-submit and race conditions (loading lock, ignore out-of-order responses).

   - Crash safety: ErrorBoundary + a `reportError()` stub (console in __DEV__ only, no sensitive data) ready to connect to a logging service later.

   - Mock repositories simulate latency and random failures behind a DEV flag (`MOCK_FAILURE_RATE`) so loading/error/retry/offline states can be tested.



== FEATURES THAT NEED UI (include ALL sub-pages so no screen is missing) ==

STUDENT

- Home: greeting, today's tasks, upcoming deadlines, continue learning, quick AI actions.

- Courses: list + join class by code (modal).

  - Course detail (tabs: Stream/Announcements · Lessons · Tasks · Grades · People).

  - Announcement detail + comments (add/delete own comment).

  - Lesson/Material viewer: PDF/slide placeholder, video player (expo-video), transcript view, "Summarize with AI" button.

  - Assignment detail + submit (file attach, text), status (Assigned/Submitted/Late/Graded). Late-submission rule: if the instructor does not allow late submissions, the file stays "attached/draft" only, and a "Turn in" button appears when the student reopens it later; if allowed, show a "Late" badge on submit.

  - Quiz taking (timer, progress, review, instant rationale) and Result screen.

  - Leave class (confirm).

- To-do: auto-generated from assignments (due date) with checklist, filters (Today/Upcoming/Overdue/Done), sort, progress bar.

- Study Planner: AI-generated daily schedule from deadlines/exams (mock output), calendar/week view, edit/move block, mark done, add exam date.

- AI: (a) Chat with AI (history, typing indicator, suggestions), (b) Lesson/Video Summarizer (bullets, TL;DR, mind map view, copy/share), (c) Flashcards and Practice Quiz generator (flip card, rationale). Create an `ai-service` interface with a mock (one file to swap for the real API).

- Notifications (grouped, mark read, tap → deep link to the right screen).

- Account tab sub-pages: Edit Profile (name, photo via expo-image-picker, validation) · Change Password · Notification Settings · Appearance (light/dark/auto) · Language (if feasible) · Privacy & Security (sessions, sign out all) · Help/FAQ · About/Terms/Privacy Policy · Logout confirm.



INSTRUCTOR

- Home/Analytics: engagement metrics, content consumption, struggling concepts (simple charts, no heavy library; use react-native-svg if needed).

- Classes: create class (name, section, auto-generated code), list, archive, delete (confirm).

  - Class detail (tabs: Stream · Materials · Assessments · People · Grades).

  - Post announcement (+ view/moderate comments).

  - Materials: upload lesson (PDF/slides/video .mp4 .mov) with progress and a mock "AI transcript + key objectives" result, edit/delete.

  - Assignment create: title, instructions, due date, points, allow-late toggle, attachments.

  - People: student list, remove student (confirm), student profile/progress.

- Quiz: manual create (Multiple Choice, Identification, Essay); AI Quiz Synthesizer (Multiple Choice only: source module/video, count, difficulty, Bloom's level; preview/edit/regenerate before publishing; filter by Bloom/difficulty); Draft/Published.

- Grading: submissions list per assessment, grade submission (score, rubric/feedback, comment), return grade; gradebook table (horizontal scroll), export placeholder.

- Notifications · AI assistant (shared) · Account with the same sub-pages as the student.



== EXTRA IDEAS (UI + mock only, low effort) ==

Global search · pull-to-refresh · offline/no-connection banner · skeleton loaders · empty-state illustrations (mascot) · dark mode support where tokens allow · pinned announcements · class code QR/share · due-date reminders (local only, expo-notifications) · achievements/streak (student) · rubric templates (instructor) · bulk grading actions · accessibility (accessibilityLabel/role, 44pt min touch target, contrast) · haptic feedback on key actions.





== PHASES (one at a time; stop after each) ==

P0 Audit: scan src/, list (max 25 lines) missing screens, duplicates, and wrong back/route behavior. Do not edit code yet. Propose the final route map (student + instructor) and wait for "ok". After "ok", save it to docs/ROUTE-MAP.md.

P1 Foundation: tokens, shared UI kit (incl. AppImage + Icon), ErrorBoundary, use-safe-back v2, transitions config, role guards, repository/hook pattern, QueryCache + CacheStore, AppError + retry/timeout helpers, network/offline hook, draft-autosave hook, font/asset preload at splash, clearCache helper, api-client stub, secure-store session.

P2 Student: all student screens/sub-pages, using the repositories/hooks from P1 (no ad-hoc stores).

P3 Instructor: complete all instructor screens/sub-pages.

P4 Shared: AI, Notifications, Account + sub-pages (role-aware, no duplication).

P5 Hardening: responsive pass (360, 411, 768 widths), a11y, security checklist, performance pass (list virtualization, re-render check on Home, Course detail, Gradebook), reliability pass (offline, retry, MOCK_FAILURE_RATE test), dead-code and duplicate cleanup, README and docs/api-contract.md update (map each repository method to the endpoint the backend must build).



Do only the phase named in my message. If none is named, ask which phase.