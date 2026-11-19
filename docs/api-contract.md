# API contract

What the backend has to build for the existing clients. Every row maps a client call that exists
today to the endpoint it must become.

Status: **no client talks to a real server yet.** The mobile app runs on mock repository
implementations and `studia-admin` on `core/data/mock/mockBackend.js`. This file is the handover
document: implement these endpoints and each mock implementation can be replaced one file at a
time, without touching a hook or a screen.

Updated at P5 (2026-11-19). Keep it in step with the repository interfaces, the mock auth service
and `backend/database/migrations/*.sql` — when a data shape changes, all four change together.

## Conventions

- Base URL: `EXPO_PUBLIC_API_URL` (mobile), `VITE_API_URL` (admin). Paths below are relative to it.
- JSON in, JSON out, UTF-8. All times are ISO 8601 with an offset (`2026-11-19T17:00:00+08:00`);
  the clients format for Asia/Manila.
- Auth: `Authorization: Bearer <accessToken>` on everything except the auth endpoints.
- Every id in a path is an opaque server-generated string. The client sends ids it was given,
  and validates their shape before use (`core/logic/route-params.ts`), but **the server must not
  trust any client id**: check ownership on every request.
- Errors: HTTP status plus `{ "code": "...", "message": "..." }`. The client maps the status to an
  `AppError` (`core/data/errors/app-error.ts`) and shows its own wording, so `message` is for logs,
  not for users. Codes the client already distinguishes:

  | Status | AppError code | Retried by the client |
  |---|---|---|
  | 400/422 | `validation` | no |
  | 401 | `unauthorized` | no |
  | 404 | `not_found` | no |
  | 409 | `conflict` | no |
  | 5xx, network failure | `network` | yes, 3 attempts, exponential backoff |
  | timeout (10 s client-side) | `timeout` | yes |

- **Reads** may be retried automatically, so `GET` must be side-effect free.
  **Writes** are never retried automatically. Creates and submits should still accept an
  `Idempotency-Key` header (`shared/utils/id.ts` → `newIdempotencyKey()`) so a user-initiated
  retry cannot produce a duplicate record.
- **Pagination** is not yet in the repository interfaces (every list method returns the whole
  collection). List endpoints should take `?cursor=&limit=` and return
  `{ items: [...], nextCursor: string | null }` from day one; the `AppList` component already
  supports `onEndReached`, and adding the parameters is then a repository-only change.
- Caching: the client caches reads by key with a TTL (5 min for static lists, 30 s for streams and
  notifications, AI results until the source changes) and revalidates in the background. Send
  `ETag`/`Cache-Control` if you want to make that cheaper; the client does not require it.

## Auth

Source of truth for behaviour: `studia-mobile/src/features/auth/data/auth-service.ts` (a complete
mock server: validation, OTP lifecycle, resend throttling, attempt limits, lockouts, typed error
codes). The client-side rules that the server must enforce for real are listed under
"Server requirements" below.

| Client call (`auth-service.ts`) | Endpoint | Notes |
|---|---|---|
| `login({ email, password, role })` | `POST /auth/login` | Verifies the role matches the account. 423/`OTP_LOCKED` after 5 failures, 60 s lock. |
| `register(input, role)` | `POST /auth/register` | Creates an unverified account and sends a signup OTP. |
| `resendOtp(email, purpose)` | `POST /auth/otp/resend` | Throttled: one per 30 s. |
| `verifyOtp({ email, code, purpose })` | `POST /auth/otp/verify` | Max 5 attempts per code, 5 min TTL. Returns a session, or a short-lived token for `reset` / `google_signup`. |
| `loginWithGoogle(idToken, role)` | `POST /auth/google` | The **server** verifies the Google ID token; never trust a client-decoded payload. |
| `completeGoogleProfile(input)` | `POST /auth/google/complete` | Finishes a first-time Google signup with the profile token from the previous step. |
| `requestPasswordReset(email)` | `POST /auth/password/forgot` | Always answers 200, whether or not the address exists (no account enumeration). |
| `resetPassword({ token, password })` | `POST /auth/password/reset` | Consumes the reset token from `verifyOtp`. |

Session shape the client expects:

```json
{
  "user": { "id": "...", "role": "student|instructor", "fullName": "...", "email": "...",
            "course": "BSIT", "year": "3", "section": "A", "department": null, "phone": null },
  "accessToken": "...",
  "expiresAt": 1763536800000
}
```

Server requirements (these are **not** satisfiable on the client, see the comments in
`auth-service.ts`):

- Hash passwords with argon2id or bcrypt. Store only a hash of each OTP, with its expiry.
- Verify Google ID tokens server-side against Google's keys, and check the `aud` claim.
- Rate-limit login, register, OTP resend and password reset per account **and** per IP.
- Never reveal whether an email exists — same response and timing either way.
- Enforce the role on every request from the token's claim. `REQUIRE_INSTRUCTOR_APPROVAL` in
  `auth-service.ts` exists because self-registration as an instructor is a privilege escalation:
  instructor accounts must be approved by the admin before they can create classes.
- Return a refresh token (or a short-lived access token plus a re-auth path). The mobile client
  will persist tokens with `expo-secure-store` — see "Known gaps".

## Student

Each row is one method of one repository in `studia-mobile/src/features/student/data/`. The hook
column is what screens actually call.

### `ClassRepository` — `classes-repository.ts` · hooks `useClasses`, `useClass`

| Method | Endpoint | Notes |
|---|---|---|
| `list()` | `GET /student/classes` | The caller's joined classes, with `progress` (0..1). |
| `get(id)` | `GET /student/classes/{id}` | 404 when the student is not a member — do not leak existence. |
| `joinByCode(code)` | `POST /student/classes/join` | Body `{ code }`, 6 chars `[A-Z0-9]`. 404 unknown code, 409 already a member. |
| `leave(id)` | `DELETE /student/classes/{id}/membership` | Leaves the class; submissions are kept. |

### `AnnouncementRepository` — `announcements-repository.ts` · `useAnnouncements`, `useAnnouncement`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /student/classes/{classId}/announcements` | Pinned first, then newest. 30 s TTL. |
| `get(classId, id)` | `GET /student/classes/{classId}/announcements/{id}` | Includes `comments[]`. |
| `addComment(classId, id, text)` | `POST /student/classes/{classId}/announcements/{id}/comments` | Body `{ text }`, ≤ 500 chars. Store and return it as **plain text**. |
| `deleteComment(classId, id, commentId)` | `DELETE /.../comments/{commentId}` | Only the comment's author (403 otherwise). |

### `LessonRepository` — `lessons-repository.ts` · `useLessons`, `useLesson`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /student/classes/{classId}/lessons` | |
| `get(classId, id)` | `GET /student/classes/{classId}/lessons/{id}` | Returns `videoUrl`, `attachments[]`, `transcript[]` and the AI summary state. Videos are **streamed by URI**, never downloaded whole. |

### `AssignmentRepository` — `assignments-repository.ts` · `useAssignments`, `useAssignment`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /student/classes/{classId}/assignments` | `status`: `assigned` · `draft` · `submitted` · `late` · `graded`. |
| `get(classId, id)` | `GET /student/classes/{classId}/assignments/{id}` | |
| `attach(classId, id, { text, file })` | `POST /student/classes/{classId}/assignments/{id}/submission` | Multipart. **The server decides the outcome**, not the client: past due and late allowed → `late`; past due and late not allowed → keep as `draft`; otherwise `submitted`. Needs `Idempotency-Key`. |
| `turnIn(classId, id)` | `POST /.../submission/turn-in` | Only valid from `draft`; 409 otherwise. Needs `Idempotency-Key`. |

### `QuizRepository` — `quizzes-repository.ts` · `useClassQuizzes`, `useQuiz`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /student/classes/{classId}/quizzes` | Published quizzes only. |
| `get(classId, id)` | `GET /student/classes/{classId}/quizzes/{id}` | **Must not include the correct answers** before the attempt is submitted. |
| `submitAttempt(classId, quizId, answers)` | `POST /student/classes/{classId}/quizzes/{quizId}/attempts` | The server scores it and returns the attempt with per-question rationale. One attempt unless the quiz allows more (409). Needs `Idempotency-Key`. |

### `TaskRepository` — `tasks-repository.ts` · `useTasks`, `useToggleTask`

| Method | Endpoint | Notes |
|---|---|---|
| `list()` | `GET /student/tasks` | **Derived server-side** from the student's assignments and quizzes across all classes — not a list the user maintains. The mock composes it from the other repositories; one endpoint avoids that fan-out. 30 s TTL. |
| `toggleDone(id)` | `PATCH /student/tasks/{id}` | Body `{ done }`. Only for items with no submission behind them; 409 `conflict` when the task is already completed by a real submission. |

### `PlannerRepository` — `planner-repository.ts` · `usePlanner`

| Method | Endpoint | Notes |
|---|---|---|
| `getWeek()` | `GET /student/planner/week` | The AI-generated study schedule plus exam dates. |
| `moveBlock(blockId, dayIso, startHour)` | `PATCH /student/planner/blocks/{blockId}` | Body `{ dayIso, startHour }`. |
| `markBlockDone(blockId, done)` | `PATCH /student/planner/blocks/{blockId}` | Body `{ done }`. |
| `addExam(title, dateIso)` | `POST /student/planner/exams` | |
| `regenerate()` | `POST /student/planner/regenerate` | Re-runs the planner from current deadlines. Expect it to be slow; the client shows its own progress state. |

## Instructor

From `studia-mobile/src/features/instructor/data/`. Every endpoint must check that the caller owns
the class before doing anything.

### `InstructorClassRepository` — `classes-repository.ts` · `useInstructorClasses`, `useInstructorClass`

| Method | Endpoint | Notes |
|---|---|---|
| `list()` | `GET /instructor/classes` | |
| `get(id)` | `GET /instructor/classes/{id}` | |
| `create({ title, section, code })` | `POST /instructor/classes` | The **server** generates the 6-character `joinCode` and guarantees it is unique. Needs `Idempotency-Key`. |
| `archive(id, archived)` | `PATCH /instructor/classes/{id}` | Body `{ archived }`. |
| `remove(id)` | `DELETE /instructor/classes/{id}` | Destructive; the client confirms first. |

### `InstructorAnnouncementRepository` — `announcements-repository.ts` · `useClassAnnouncements`, `useAnnouncement`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /instructor/classes/{classId}/announcements` | |
| `get(classId, id)` | `GET /instructor/classes/{classId}/announcements/{id}` | With `comments[]` for moderation. |
| `create(classId, { title, body, pinned })` | `POST /instructor/classes/{classId}/announcements` | `title` ≤ 100, `body` ≤ 2000. Plain text. Needs `Idempotency-Key`. |
| `deleteComment(classId, id, commentId)` | `DELETE /.../comments/{commentId}` | Moderation: the instructor may delete **any** comment in their class. |
| `remove(classId, id)` | `DELETE /instructor/classes/{classId}/announcements/{id}` | |

### `MaterialRepository` — `materials-repository.ts` · `useClassMaterials`, `useMaterial`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /instructor/classes/{classId}/materials` | |
| `get(classId, id)` | `GET /instructor/classes/{classId}/materials/{id}` | Includes `state` (`processing`/`ready`/`failed`), `transcript[]` and `objectives[]`. |
| `upload(classId, { title, attachment })` | `POST /instructor/classes/{classId}/materials` | Multipart, resumable preferred. See "File uploads". Transcription is asynchronous: return `state: "processing"` immediately; the client polls the `get` endpoint. Needs `Idempotency-Key`. |
| `remove(classId, id)` | `DELETE /instructor/classes/{classId}/materials/{id}` | Must also delete the stored file. |

### `InstructorAssignmentRepository` — `assignments-repository.ts` · `useClassAssignments`, `useInstructorAssignment`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /instructor/classes/{classId}/assignments` | |
| `get(classId, id)` | `GET /instructor/classes/{classId}/assignments/{id}` | |
| `create(classId, draft)` | `POST /instructor/classes/{classId}/assignments` | `{ title, instructions, dueAt, points, allowLate, attachments }`. `allowLate` drives the student submission rule above, so it must be enforced server-side. |
| `update(classId, id, draft)` | `PATCH /instructor/classes/{classId}/assignments/{id}` | |
| `remove(classId, id)` | `DELETE /instructor/classes/{classId}/assignments/{id}` | |

### `ClassStudentRepository` — `students-repository.ts` · `useClassStudents`, `useStudent`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /instructor/classes/{classId}/students` | With `progress`, `submittedCount`, `pendingCount`. |
| `get(classId, studentId)` | `GET /instructor/classes/{classId}/students/{studentId}` | Only data for *this* class. |
| `remove(classId, studentId)` | `DELETE /instructor/classes/{classId}/students/{studentId}` | Removes the enrolment, keeps the submissions. |

### `QuizRepository` (instructor) — `quizzes-repository.ts` · `useQuizzes`, `useQuiz`

| Method | Endpoint | Notes |
|---|---|---|
| `list()` | `GET /instructor/quizzes` | Across all of the instructor's classes. |
| `listByClass(classId)` | `GET /instructor/classes/{classId}/quizzes` | |
| `get(id)` | `GET /instructor/quizzes/{id}` | Includes correct answers (instructor view). |
| `create(draft, publish)` | `POST /instructor/quizzes` | `status` = `draft` or `published` from `publish`. Question kinds: `mc` (one `correctIndex`), `identification`, `essay`. Each question carries a Bloom level and a difficulty. Needs `Idempotency-Key`. |
| `remove(id)` | `DELETE /instructor/quizzes/{id}` | Refuse (409) once attempts exist, or archive instead. |

### `SubmissionRepository` — `submissions-repository.ts` · `useAllSubmissions`, `useSubmission`, `useGradeSubmission`

| Method | Endpoint | Notes |
|---|---|---|
| `list()` | `GET /instructor/submissions` | Everything gradable for this instructor; the client filters and sorts. Paginate this one first — it grows fastest. |
| `listByQuiz(quizId)` | `GET /instructor/quizzes/{quizId}/submissions` | |
| `get(id)` | `GET /instructor/submissions/{id}` | |
| `grade(id, score, feedback)` | `POST /instructor/submissions/{id}/grade` | Validate `0 ≤ score ≤ maxScore` server-side. Returns the submission with `gradedAt`, which also makes the grade visible to the student. Needs `Idempotency-Key`. |

### `AnalyticsRepository` — `analytics-repository.ts` · `useAnalytics`, `useInstructorStats`

| Method | Endpoint | Notes |
|---|---|---|
| `get()` | `GET /instructor/analytics` | Engagement, content-consumption rates and struggling concepts, aggregated server-side (the client only renders). `useInstructorStats` derives the Home counters from the same payload — one endpoint is enough. |

## Shared

### `NotificationRepository` — `features/shared-screens/data/notifications-repository.ts`

| Method | Endpoint | Notes |
|---|---|---|
| `listByRole(role)` | `GET /notifications` | Role comes from the token, not from the query. Each item carries a deep-link target. 30 s TTL. |
| `markRead(role, id)` | `PATCH /notifications/{id}` | Body `{ read: true }`. |
| `markAllRead(role)` | `POST /notifications/read-all` | |

### AI

The three AI features (transcription, summary/concept map, quiz synthesis) are mocked inside
`materials-repository.ts` and `logic/ai-quiz-generator.ts` today; there is no `ai-service`
interface yet (see "Known gaps"). The endpoints they need:

| Purpose | Endpoint | Notes |
|---|---|---|
| Transcribe an uploaded video | (internal, triggered by the material upload) | Async; the material's `state` goes `processing` → `ready`/`failed`. |
| Summarize a lesson / transcript | `POST /ai/summary` | `{ sourceId, mode: "bullets"\|"tldr"\|"mindmap" }`. Cache by `sourceId` + mode until the source changes; a "Regenerate" action must be able to bypass that cache. |
| Generate a quiz | `POST /ai/quiz` | `{ sourceId, count, difficulty, bloomLevels }` → Multiple Choice only. |
| Chat | `POST /ai/chat` | `{ messages }`, streaming preferred. |
| Study planner | `POST /student/planner/regenerate` | Same endpoint as the planner above. |

### File uploads

Used by material upload and assignment submission. The client validates before sending
(`shared/utils/file.ts`): extension whitelist `pdf, doc, docx, ppt, pptx, mp4, mov, jpg, jpeg,
png`, ≤ 500 MB for materials and ≤ 50 MB for submissions, and a sanitized file name.

That validation is a convenience, not a control. The server must independently:

- re-check the extension **and** sniff the actual content type, rather than trusting the
  `Content-Type` header or the file name;
- enforce its own size limit, and cap total storage per class;
- store the file under an id it generates, never under the client's file name, and serve downloads
  with `Content-Disposition: attachment`;
- check that the caller owns the class (instructor) or is enrolled in it (student);
- scan for malware before the file is ever served back to anyone.

## Admin (web)

`studia-admin/src/core/data/api.js` is the only module its UI calls; each function currently
delegates to `mockBackend.js`. Paths below are proposals — this surface has not been reviewed as
closely as the mobile one, and the single admin account is still hard-coded in the mock.

| `api.js` function | Endpoint |
|---|---|
| `login` | `POST /admin/login` |
| `sendOtp` / `verifyOtp` / `updatePassword` | `POST /admin/otp/send` · `POST /admin/otp/verify` · `POST /admin/password` |
| `getDashboard` | `GET /admin/dashboard` |
| `getUsers` | `GET /admin/users` |
| `blockUsers` / `unblockUsers` | `POST /admin/users/block` · `POST /admin/users/unblock` (block only affects Active users, unblock only Blocked) |
| `deleteUsers` | `POST /admin/users/delete` |
| `approveUser` | `POST /admin/users/{id}/approve` (this is the instructor approval gate) |
| `getSettings` / `saveSettings` | `GET /admin/settings` · `PUT /admin/settings` |
| `runBackup` | `POST /admin/backup` |

## Known gaps

Carried forward deliberately; each one is a client change, not a blocker for the backend.

1. **No token persistence.** `core/data/storage/session-store.ts` keeps the user in memory only, so
   a restart signs the user out. When the real `/auth` endpoints exist, persist `accessToken` with
   `expo-secure-store` (never AsyncStorage, never the query cache) and hydrate the store at
   startup. `expo-secure-store` is not installed yet.
2. **No pagination or cursors** in the repository interfaces, as described under Conventions.
3. **No idempotency key** in the repository method signatures yet; `shared/utils/id.ts` provides
   `newIdempotencyKey()` ready for it.
4. **No `ai-service` interface.** The AI mocks are spread across the instructor repositories and
   `core/data/mock/mock-data.ts` instead of sitting behind one swappable module.
5. **`core/data/api-client/api-client.ts`** (timeout, typed errors, bearer token) is written and
   unused. It is what the repository implementations should call.
