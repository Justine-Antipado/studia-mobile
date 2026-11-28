# API contract

What the backend has to build for the existing clients. Every row maps a client call that exists
today to the endpoint it must become.

Status: **no client talks to a real server yet.** The mobile app runs on mock repository
implementations and `studia-admin` on `core/data/mock/mockBackend.js`. This file is the handover
document: implement these endpoints and each mock implementation can be replaced one file at a
time, without touching a hook or a screen.

Updated at admin phase 5 (2026-11-20); mobile sections last reviewed at P5 (2026-11-19). Keep it in step with the repository interfaces, the mock auth service
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
| `profileRepository.requestOtp(purpose)` | `POST /api/me/otp-send` | Signed in; the address comes from the token. `purpose` is `profile_update` or `password_change`. Emails a 6-digit code through the project SMTP; same 30 s resend / hourly throttle as the auth OTPs. |
| `profileRepository.updateProfile(user, patch, code)` | `POST /api/me/profile-update` | The server verifies `code` (5 min, 5 attempts, single use) and applies the edit in the same call, so there is no client-side "verified" state. Editable: `fullName`, `phone`, `course`/`year`/`section` (student) or `department` (instructor). **Email is not editable here.** |
| `profileRepository.setAvatar(user, file \| null)` · `loadAvatar()` | `POST /api/me/avatar` `{action: set\|remove\|get, data?: base64}` | JPEG/PNG sniffed from bytes, max 2 MB, stored in the private `avatars` bucket; the response is a 24 h signed URL. |
| `profileRepository.changePassword(newPassword, code)` | `POST /api/me/password-change` | Verifies `code` and sets the password in one call; same five password rules as sign-up. |

**Security note:** migration 001 still grants `authenticated` direct `UPDATE` on `full_name, phone, course, year_level, section, department`. Profile edits are meant to go through the OTP-gated `PATCH /me`, so before the real client is wired, revoke those column grants (or keep them only for fields that need no OTP) or the OTP can be bypassed with a direct table update.

New accounts are **Gmail-only** (`@gmail.com`, migration 010 "Before User Created" hook, which covers
email signup and Google sign-in). The seeded demo accounts (`@omsc.edu.ph` / `@omsu.edu.ph`) can still
log in. The client shows the Gmail hint on sign-up and password reset only, never on login.

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

Comments are returned for **both roles** with `authorIsMe` (computed for the caller) and
`authorIsInstructor` (true when the author owns the class; the UI shows an "Instructor" badge). Never
return a `studentId` or email in a comment.

### `LessonRepository` — `lessons-repository.ts` · `useLessons`, `useLesson`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /student/classes/{classId}/lessons` | |
| `get(classId, id)` | `GET /student/classes/{classId}/lessons/{id}` | Returns `link` (`{ provider, url, videoId }`, for video lessons) or `attachment` (documents/slides), `transcript[]`, the AI summary and `regensLeft`. A video is a **link**, never a stored file: the app shows a thumbnail and opens the link outside the app. |
| `regenerateSummary(classId, id)` | `POST /student/classes/{classId}/lessons/{id}/summary/regenerate` | Rate-limited per lesson (3). 409 when the cap is reached or there is no transcript. The cached summary is reused on every normal view. |

### `AssignmentRepository` — `assignments-repository.ts` · `useAssignments`, `useAssignment`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /student/classes/{classId}/assignments` | `status`: `assigned` · `draft` · `submitted` · `late` · `graded`. |
| `get(classId, id)` | `GET /student/classes/{classId}/assignments/{id}` | |
| `attach(classId, id, { text, file })` | `POST /student/classes/{classId}/assignments/{id}/submission` | Multipart. **The server decides the outcome**, not the client: using **its own clock**: past due and late allowed → `late`; past due and late not allowed → keep as `draft`; otherwise `submitted`. When the assignment has `closesAt` and it has passed, reject (409) instead of keeping a draft. Needs `Idempotency-Key`. |
| `turnIn(classId, id)` | `POST /.../submission/turn-in` | Only valid from `draft`; 409 otherwise. Needs `Idempotency-Key`. |

### `QuizRepository` — `quizzes-repository.ts` · `useClassQuizzes`, `useQuiz`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /student/classes/{classId}/quizzes` | Published quizzes only. |
| `get(classId, id)` | `GET /student/classes/{classId}/quizzes/{id}` | **Must not include the correct answers** before the attempt is submitted. Includes `dueAt`, `allowLate`, `timeLimitMin` and a server-computed `closed` flag (the client only displays it). |
| `submitAttempt(classId, quizId, answers)` | `POST /student/classes/{classId}/quizzes/{quizId}/attempts` | The server scores it and returns the attempt with per-question rationale. One attempt unless the quiz allows more (409). **409 `quiz_closed`** after the due date when late is not allowed, or after `closesAt`; an attempt accepted after the due date is stored with `late = true`. The time limit must also be enforced from a server-side `started_at`, not the client countdown. Needs `Idempotency-Key`. |

### `TaskRepository` — `tasks-repository.ts` · `useTasks`, `useToggleTask`

| Method | Endpoint | Notes |
|---|---|---|
| `list()` | `GET /student/tasks` | **Derived server-side** from the student's assignments and quizzes across all classes — not a list the user maintains. The mock composes it from the other repositories; one endpoint avoids that fan-out. 30 s TTL. |
| `toggleDone(id)` | `PATCH /student/tasks/{id}` | Body `{ done }`. Only for items with no submission behind them; 409 `conflict` when the task is already completed by a real submission. |

### `PlannerRepository` — `planner-repository.ts` · `usePlanner`

Manual, not AI-generated: the student is the one who schedules their own plans. The only automatic
placement is a block per pending task (assignment/quiz), computed from `student_tasks` at read
time on its real due date — never stored, so posting a task places it on the planner without a
write of its own.

| Method | Endpoint | Notes |
|---|---|---|
| `list()` | `GET /student/planner` | The caller's manual blocks plus any exam dates for a ±365-day window around today, merged with the computed task blocks. A block whose task is already turned in is returned as `done`. |
| `addPlan(input)` | `POST /student/planner/blocks` | Body `{ dayIso, title, notes, priority, startHour, durationHours }`. |
| `updatePlan(blockId, input)` | `PATCH /student/planner/blocks/{blockId}` | Same body as `addPlan`; full replace, not a partial move. Only ever called on a manual block — a task-derived block has no row to update. |
| `markBlockDone(blockId, done)` | `PATCH /student/planner/blocks/{blockId}` | Body `{ done }`. |
| `deleteBlock(blockId)` | `DELETE /student/planner/blocks/{blockId}` | Manual blocks only. |

The Add Plan form's "exam" option (and `addExam`/`POST /student/planner/exams`) was removed from
the mobile client as redundant — there is no client call left that creates a `planner_exams` row.
`list()` still returns any exam dates that already exist, because `private.send_exam_reminders()`
(migration 045) depends on that table: a daily job that notifies a student the morning before each
exam date on record. Every other notification in this app is trigger-based (fires off a row
insert/update); this is the one exception, since nothing is written on the day itself for a
trigger to fire from.

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
| `addComment(classId, id, text)` | `POST /instructor/classes/{classId}/announcements/{id}/comments` | Body `{ text }`, ≤ 500 chars, plain text. The instructor comments as themselves (allowed by `cmt_insert`: class member **or** class owner). |
| `deleteComment(classId, id, commentId)` | `DELETE /.../comments/{commentId}` | Moderation: the instructor may delete **any** comment in their class. |
| `remove(classId, id)` | `DELETE /instructor/classes/{classId}/announcements/{id}` | |

### `MaterialRepository` — `materials-repository.ts` · `useClassMaterials`, `useMaterial`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /instructor/classes/{classId}/materials` | |
| `get(classId, id)` | `GET /instructor/classes/{classId}/materials/{id}` | Includes `state` (`processing`/`ready`/`failed`), `transcript[]` and `objectives[]`. |
| `addVideoLink(classId, { title, url })` | `POST /instructor/classes/{classId}/materials/video-link` | See "Lesson videos" below. Returns `state: "processing"`. Needs `Idempotency-Key`. |
| `provideTranscript(classId, id, text)` | `PUT /instructor/classes/{classId}/materials/{id}/transcript` | Fallback when no captions could be fetched: ≤ 50,000 chars; the AI then builds the summary and objectives from it. |
| `upload(classId, { title, attachment })` | `POST /instructor/classes/{classId}/materials` | **Documents and slides only** (pdf, doc(x), ppt(x)); a video file is rejected (422): send a link instead. | Multipart, resumable preferred. See "File uploads". Transcription is asynchronous: return `state: "processing"` immediately; the client polls the `get` endpoint. Needs `Idempotency-Key`. |
| `remove(classId, id)` | `DELETE /instructor/classes/{classId}/materials/{id}` | Must also delete the stored file. |

### `InstructorAssignmentRepository` — `assignments-repository.ts` · `useClassAssignments`, `useInstructorAssignment`

| Method | Endpoint | Notes |
|---|---|---|
| `listByClass(classId)` | `GET /instructor/classes/{classId}/assignments` | |
| `get(classId, id)` | `GET /instructor/classes/{classId}/assignments/{id}` | |
| `create(classId, draft)` | `POST /instructor/classes/{classId}/assignments` | `{ title, instructions, dueAt, points, allowLate, closesAt?, attachments }`. `allowLate` drives the student submission rule above, so it must be enforced server-side. `dueAt` is a UTC ISO string (the UI shows it in the device zone). `closesAt` (optional, needs `allowLate`, ≥ `dueAt`) is the last moment a late turn-in is accepted. |
| `update(classId, id, draft)` | `PATCH /instructor/classes/{classId}/assignments/{id}` | Same body. **The attachment list in the body replaces the stored list**, so the client must send the existing attachments it wants to keep (the edit form preloads them); removed ones must also be deleted from Storage. Rules: `points` cannot go below a score already given (422); moving `dueAt` re-tags turned-in work `submitted` ↔ `late` and leaves `graded` alone (migration 011 trigger). Past due dates are allowed on edit (to extend a deadline) but not on create. |
| `listSubmissions(classId, id)` | `GET /instructor/classes/{classId}/assignments/{id}/submissions` | The class roster **left-joined** with submissions: one row per enrolled student with `status` = `missing` · `draft` · `submitted` · `late` · `graded`, `submittedAt`, `text`, `file` (signed URL, short expiry), `score`, `feedback`, `gradedAt`. Class owner only. |
| `gradeSubmission(classId, id, studentId, { score, feedback })` | `POST /instructor/classes/{classId}/assignments/{id}/submissions/{studentId}/grade` | `0 ≤ score ≤ assignment.points` (also a DB trigger). 409 when the student has not turned it in (`draft`/`missing`). Sets `status = graded`; the grade is then visible to the student. Needs `Idempotency-Key`. |
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
| `create(draft, publish)` | `POST /instructor/quizzes` | `status` = `draft` or `published` from `publish`. Question kinds: `mc` (one `correctIndex`), `identification`, `essay`. Each question carries a Bloom level and a difficulty. Schedule: `{ dueAt, allowLate, closesAt?, timeLimitMin? }`; publishing requires a future `dueAt`, and `closesAt` > `dueAt` when `allowLate` (migration 011 constraints). Needs `Idempotency-Key`. |
| `update(id, draft, publish)` | `PUT /instructor/quizzes/{id}` | Same body. **Once any attempt exists the questions, options and answer keys are frozen** (409; DB trigger in migration 011): only the title and the schedule may change, and the quiz cannot go back to `draft`. On a published quiz the due date may be extended even after it has passed. |
| `remove(id)` | `DELETE /instructor/quizzes/{id}` | Refuse (409) once attempts exist, or archive instead. |

### `SubmissionRepository` — `submissions-repository.ts` · `useAllSubmissions`, `useSubmission`, `useGradeQuestion`, `useReleaseGrade`

| Method | Endpoint | Notes |
|---|---|---|
| `list()` | `GET /instructor/submissions` | Everything gradable for this instructor; the client filters and sorts. Paginate this one first — it grows fastest. |
| `listByQuiz(quizId)` | `GET /instructor/quizzes/{quizId}/submissions` | |
| `get(id)` | `GET /instructor/submissions/{id}` | Includes one `answers[]` entry per essay/identification question: `{ questionId, type, prompt, response, maxPoints, awardedPoints, correctAnswer }`. Multiple choice is never listed — it is always auto-final. |
| `gradeQuestion(attemptId, questionId, points)` | `POST /instructor/submissions/{id}/questions/{questionId}/grade` | Sets one question's points (`0 ≤ points ≤ maxPoints`, validated server-side). Does **not** reveal anything to the student by itself. Needs `Idempotency-Key`. |
| `release(attemptId, feedback)` | `POST /instructor/submissions/{id}/release` | "Turn in": refuses (422) unless every essay/identification question already has points, then sums every question's points into the attempt score, stamps `gradedAt`, and that is what makes the grade visible to the student. Needs `Idempotency-Key`. |

A quiz submission carries `late` (set by the database from its own clock) and its `score` is `null`
while it contains an essay or identification question that has not been released yet ("needs
grading"). Multiple choice is auto-scored and final immediately. Identification is auto-scored too,
but only as a **suggestion** — `awardedPoints` starts pre-filled from the exact-match check and stays
editable, and the attempt is not final until the instructor calls `release`, exactly like essay.

### `GradebookRepository` — `gradebook-repository.ts` · `useGradebook`

| Method | Endpoint | Notes |
|---|---|---|
| `list(classId or null)` | `GET /instructor/gradebook?classId=` | One row per (student, assignment-or-quiz) for classes the caller owns: `{ classId, kind: assignment/quiz, refId, title, studentId, score, max, status: graded/pending/missing, gradedAt, attemptId }`. Join by **`classId`, never by subject code** (two sections can share a code). Paginate by class/item; the client does the per-student aggregation (overall % = sum(score) / sum(max) over graded items, weighted by points). |

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

Notification rows are **created by events** (database triggers or the API), never typed by hand, and
the actor is never notified about their own action. Each item has `tag`, `title`, `meta`, optional
`body` (shown in the detail sheet; opening the sheet marks it read) and `createdAt`; the client
formats the age. The mobile mock produces them from these events:

| Event | Recipients | Tag |
|---|---|---|
| Announcement posted | enrolled students | Notice |
| Comment on an announcement | the post's author and earlier commenters | Class |
| Assignment created / due date changed | enrolled students | Reminder |
| Student turns in (not a draft) | class owner | Grade |
| Assignment or quiz graded | that student | Grade |
| Quiz published (create, or draft → published) | enrolled students | Quiz |
| Quiz attempt submitted | class owner | Grade |
| Material or video link added | enrolled students | Lesson |
| Student joins a class | class owner | Class |
| Exam added to the planner, morning before | that student | Reminder |

`markRead` is allowed only for the row's owner (RLS). The tab badge is the unread count of this feed.

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

### Lesson videos (links)

A video lesson is a link. Migration `20260101000014_material_video_links.sql` adds
`materials.video_url`, `video_provider`, `video_id` and the constraints below.

- **Validate on the server** (the client check in `shared/utils/video-link.ts` is only feedback):
  `https` only, no `user:pass@`, ≤ 2048 chars, no `localhost`, raw IP or single-label host. YouTube
  forms accepted: `youtube.com/watch?v=`, `/shorts/`, `/embed/`, `/live/`, `m.youtube.com`,
  `music.youtube.com`, `youtu.be/`. Store the canonical `https://www.youtube.com/watch?v=ID` and the
  11-character id. Any other https host is stored as `provider: other` and is only ever *opened*.
- **Never fetch the URL.** The server must not request an arbitrary `video_url` (SSRF). For YouTube it
  asks the captions API for the `video_id` only; for other hosts there is no transcript, the material
  goes to `failed` and the instructor pastes one (`provideTranscript`).
- **The client never renders the URL in a WebView.** It builds the thumbnail
  (`img.youtube.com/vi/{id}/hqdefault.jpg`) from the validated id and opens the link with the system
  (`Linking`, falling back to the in-app browser tab).
- **AI summary from a link:** transcript from captions → summary, cached per material
  (`material_summaries`). Not every video has captions and the captions API has a quota, so the states
  are `processing` → `ready` | `failed`, polled by the client. "Regenerate" is capped (`regen_count`
  ≤ 3) because each call costs money.
- Uploaded files keep the 50 MB cap (migration 012).

### File uploads

Used by material upload and assignment submission. The client validates before sending
(`shared/utils/file.ts`): extension whitelist `pdf, doc, docx, ppt, pptx` for materials (videos are links) and, for submissions, `jpg, jpeg, png` as well, ≤ 50 MB for materials (bucket `file_size_limit`, migration 012; the free plan allows no more) and ≤ 50 MB for submissions, and a sanitized file name.

That validation is a convenience, not a control. The server must independently:

- re-check the extension **and** sniff the actual content type, rather than trusting the
  `Content-Type` header or the file name;
- enforce its own size limit, and cap total storage per class;
- store the file under an id it generates, never under the client's file name, and serve downloads
  with `Content-Disposition: attachment`;
- check that the caller owns the class (instructor) or is enrolled in it (student);
- scan for malware before the file is ever served back to anyone.

## Admin (web)

`studia-admin/src/core/data/api.js` is the only module its UI calls. It now picks one of two
interchangeable backends from `VITE_USE_MOCK`:

- `core/data/mock/mockBackend.js` — in-memory, the default;
- `core/data/http/httpBackend.js` — real calls through `core/data/http/client.js`.

Both expose the same method names and the same shapes, so no component knows which is active.
Everything below is under **`/api/admin`** and matches `backend/src/Modules/Admin`
(`Controllers/ Services/ Repositories/ Validators/`).

This section is **complete**: every screen the admin portal has is listed below, and the UI calls
no endpoint that is not here. Of the whole surface, exactly one endpoint creates anything
(`createAnnouncement`) and five delete; everything else reads. Sub-headings group the endpoints by
area, not by the order they were built.

### Conventions for this surface

- **Case.** The API answers `snake_case` (the MySQL column names); the UI consumes `camelCase`.
  `core/logic/mappers.js` (`toUi`, `toApi`) is the only place that converts, and it is called by
  the data layer, never by a component.
- **Lists.** Every list endpoint accepts `?page=&page_size=&sort=&order=&q=` plus flat filter
  params (`role=Student&course=BSIT&year=3&section=A&department=IT&status=Active`), and answers:

  ```json
  { "data": [ /* rows */ ], "meta": { "page": 1, "page_size": 20, "total": 1284 } }
  ```

  `sort` is a column name in `snake_case`; `order` is `asc` or `desc`. Unknown sort or filter keys
  must be rejected (400), not ignored, so a typo in the UI cannot silently return everything.
- **Errors.** `{ "code": "...", "message": "...", "errors": { "<field>": "..." }, "meta": { ... } }`
  with the right status. `core/data/http/errors.js` normalizes every failure — including the
  mock's — to `{ status, code, message, fieldErrors, meta }`; `message` is shown to the admin only
  as a fallback, so keep it human but never leak whether an account exists. `meta` is display-only
  (e.g. a lockout countdown) — the client never treats it as the source of truth, only the status
  and code are.
- **401** clears the token and sends the browser to `/login`. The client retries the request once
  if a refresh handler is registered (`tokenStore.setRefreshHandler`), then gives up.
- **Token storage.** The access token is held **in memory only** (`core/data/http/tokenStore.js`);
  `localStorage` keeps just a session marker (`{ admin, hasToken }`) so a reload knows a session
  existed and other tabs can log out in sync. A full page reload therefore has no token and must
  re-authenticate. Preferred fix once the backend allows it: issue an **httpOnly, Secure,
  SameSite=Strict** refresh cookie and expose `POST /api/admin/auth/refresh`; the client then
  switches to `credentials: 'include'` and nothing else changes.
- **The client is not the authority.** Every rule in `core/logic/validation.js` (email shape and
  the Gmail-only rule for new accounts, the five password rules, 6-digit OTP, length caps) is a copy of
  `studia-mobile/src/features/auth/logic/auth-validation.ts` for the sake of fast feedback. The
  server must re-run all of it, hash passwords with argon2id/bcrypt, store OTPs hashed and
  single-use, rate-limit by account and IP, and check admin role on every request.

### Endpoints

| `api.js` function | Endpoint | Notes |
|---|---|---|
| `login` | `POST /api/admin/auth/login` | Body `{ identifier, password }`. `identifier` is the email **or** the username. One generic 401 for every failure, with `meta: { attempts_left }` so the UI can show a counter. After `LOGIN_MAX_FAILS` (5) consecutive failures, locks the account for `LOGIN_LOCK_MS` (60 s) and returns **429** with `meta: { retry_after_sec }` instead — matching `studia-mobile`'s `auth-service.ts` lock. The mock backend enforces this itself; it is not just a UI gate. Returns `{ token, admin: { id, name, username, email, role } }` on success. |
| `logout` | `POST /api/admin/auth/logout` | Revokes the token server-side; the client clears its session either way. |
| *(planned)* | `POST /api/admin/auth/refresh` | Not called yet; `tokenStore` has the hook ready. |
| `getNavCounts` | `GET /api/admin/nav-counts` | Sidebar badges: `{ "unread_notifications": 3 }`, a `COUNT(*) WHERE read = 0` over the same table `getNotifications` lists — never a separately maintained counter. Cheap, polled on every page load. |
| `getDashboard` | `GET /api/admin/dashboard` | `{ stats, registrations, role_distribution, course_distribution, ai_usage, system_health, activity }`. `stats` now includes `classes`. `system_health` adds `database` and `queue` alongside `server`/`ai_service`/`storage_used_pct`. `activity` is a generic recent-activity feed (registrations, AI usage, content, security, announcements), not just new registrations. No `pending` counter — the approval flow is gone. |
| `getUsers` | `GET /api/admin/users` | List conventions above. Status is `Active` or `Inactive` only — there is no `Blocked`, and no block/unblock action; "inactive" is set by whatever makes an account inactive in the mobile app, not an admin toggle. Row shape carries `course`/`year`/`section` for students or `department` for instructors, not one free-text `section` field. |
| `getUser` | `GET /api/admin/users/{id}` | Profile plus `classes` (enrolled for a student, owned for an instructor), `activity` (a timeline), and `ai_usage` (per-feature counts) for the `/users/:id` page. 404s with `NOT_FOUND` if the id does not exist. |
| `deleteUsers` | `POST /api/admin/users/delete` | Body `{ ids: [...] }`. Permanent; the UI makes the admin type `DELETE` first (from either the list's bulk/row action or the profile page's danger zone), and the server must write an audit-log entry. |
| `getSettings` / `saveSettings` | `GET /api/admin/settings` · `PUT /api/admin/settings` | Partial update; the server validates each section. Sections, one per `/settings/*` sub-page: `term`, `email`, `security_policy`, `uploads`, `system`, `backup`, `legal` (`{ terms, privacy }`), `ai` (`{ summarizer, planner, quiz_synthesizer, chat, language, daily_request_limit }` — the same object `getAiHealth`'s `toggles` reads/writes, so `/ai` and `/settings/ai` can never disagree). Every save is written to the audit log (see below). |
| `getSettings` / `saveSettings` — `system.maintenance` | same endpoints | The maintenance window, stored as `{ enabled, scope: "all"\|"roles"\|"features", roles: ["student","instructor"], features: ["classes","content","assessments","announcements","ai.summarizer","ai.planner","ai.quiz","ai.chat","reports","notifications"], message, starts_at, ends_at }`. `maintenance_mode` (boolean) is kept in step with `maintenance.enabled` for older clients. **The server must enforce this itself**: every student and instructor request runs the same gate the admin client uses (`studia-admin/src/core/logic/maintenance.js` · `studia-mobile/src/core/logic/maintenance.ts` — `isUnderMaintenance(config, user, feature)`), answering `503` with `{ message }` from the stored `message` when the window covers that role or that feature. Scope `all` and scope `roles` block the whole app for the named roles; scope `features` blocks only the listed modules. An admin is never blocked, or maintenance could not be switched off. A window with `starts_at` in the future is not active yet; one with `ends_at` in the past has lifted itself, without a write. Audit-logged like every other settings save. | | `runBackup` | `POST /api/admin/settings/backup/run` | Long-running; answer with the new backup record `{ last_backup_at, last_backup_size_label, ok, restore_points: [{ id, at, size_label }] }` (prepends one `restore_points` entry). Audit-logged. |
| `verifyLoginOtp` / `resendLoginOtp` | `POST /api/admin/auth/login/verify` · `POST /api/admin/auth/login/resend` | **Every admin login is two steps.** `login` with a correct password must NOT open a session: it creates a pending login (`auth_tokens.kind = 'admin_pending_login'`, hashed and single-use), stores a cryptographically random 6-digit code (`otp_codes.purpose = 'admin_login'`, hash only, with `expires_at` and `attempts`), emails it from `MAIL_FROM` (`studia.noreply2026@gmail.com`) using the branded template ("Your Studia admin login code is 123456. It expires in 5 minutes."), and answers `{ otp_required: true, pending_token, masked_email, expires_in_sec, resend_in_sec, attempts_allowed }`. `verifyLoginOtp` body `{ pending_token, code }` returns the usual `{ token, admin }`; the code is single-use. Expiry comes from `settings.email.otp_expiry_minutes` (default 5) and the resend cooldown from `settings.email.resend_seconds` (default 60). Five wrong codes burn the pending login and lock that login for **15 minutes** (429 with `meta: { retry_after_sec }`). Resends are rate-limited by the cooldown and capped (3 per pending login). Every failure — missing, stale, expired or wrong — answers the same generic `Invalid or expired code.`, with `meta: { attempts_left }` only while attempts remain. The code must never appear in a production response; in the mock it is logged to the console instead of sent. Each of these events appends a `login_attempts` row (`stage`, `note`, `ip`, `user_agent`) and an `audit_log` entry. | | `sendOtp` / `verifyOtp` / `updatePassword` | `POST /api/admin/account/otp/send` · `.../otp/verify` · `POST /api/admin/account/password` | `tables: users`, `otp_codes`. Codes are 6 digits, hashed, single-use, expire after the configured minutes, and are rate-limited by the resend interval. `devCode` in the mock response must never exist in production. `updatePassword` re-checks all five `PASSWORD_RULES` server-side (the UI shows them as a checklist, not a 0–4 score) and is audit-logged. |

Example — a filtered, sorted page of users:

```http
GET /api/admin/users?page=2&page_size=10&sort=last_active_at&order=desc&q=ana&role=Student&status=Active
```

```json
{
  "data": [
    {
      "id": 2,
      "name": "Ana Villanueva",
      "email": "ana.v@omsu.edu.ph",
      "role": "Student",
      "course": "BSIT",
      "year": "3",
      "section": "A",
      "department": null,
      "status": "Active",
      "joined_at": "2026-08-12T09:14:00+08:00",
      "last_active_at": "2026-11-19T08:02:00+08:00"
    }
  ],
  "meta": { "page": 2, "page_size": 10, "total": 37 }
}
```

An instructor row carries `department` and leaves `course`/`year`/`section` null; `composeSection` (shared with mobile) turns a student's three fields back into the `"BSIT 3-A"` display format wherever the UI needs one string.

```json
{ "code": "VALIDATION_FAILED", "message": "Unknown sort column.", "errors": { "sort": "Not sortable." } }
```

### Academics

| `api.js` function | Endpoint | Notes |
|---|---|---|
| `getClasses` | `GET /api/admin/classes` | List conventions above. Filters: `course`, `archived` (`true`/`false`). Row carries `instructor_id`/`instructor_name`, `course`/`year`/`section`/`section_label`, `student_count`, `join_code`, `archived`, `created_at`. Classes are created in the mobile app — no create or update endpoint. |
| `getClass` | `GET /api/admin/classes/{id}` | Class profile plus `roster` (`ClassStudent`-shaped: `id, name, email, progress, submitted_count, pending_count`), `materials`, `assignments`, `announcements` (that class's own, instructor-authored notices — distinct from the platform announcements below). 404s with `NOT_FOUND`. |
| `deleteClasses` | `POST /api/admin/classes/delete` | Body `{ ids: [...] }`. Permanent; cascades to that class's materials, assignments, quizzes and announcements server-side. The UI makes the admin type `DELETE` first, and the server must write an audit-log entry. |
| `getContent` | `GET /api/admin/content` | List conventions above. Filters: `kind` (`video`/`pdf`/`slide`), `processing` (`Ready`/`Processing`/`Failed`). Row carries `class_id`/`class_name`, `owner_id`/`owner_name`, `size_bytes`, `posted_at`. Materials are uploaded from the instructor's app — no create or update endpoint. |
| `deleteContent` | `POST /api/admin/content/delete` | Body `{ ids: [...] }`. Permanent; the server must also remove the stored file. Audit-logged like every other delete. |
| `getAssessments` | `GET /api/admin/assessments` | Not paginated — a campus-wide overview, not a per-row CRUD list. `{ quizzes, assignments, stats: { total_quizzes, ai_generated_pct, total_assignments, avg_submission_rate } }`. `quizzes[].source` is `AI` or `Manual`; `bloom`/`difficulty` mirror the mobile `Quiz`/`QuizQuestion` vocabulary. Read-only — no admin create, edit or delete; quizzes and assignments are managed by instructors. |
| `getAnnouncements` | `GET /api/admin/announcements` | List conventions above. Filters: `audience` (`all`/`students`/`instructors`/`course`), `status` (`Scheduled`/`Published`). These are platform-wide notices, a separate table from a class's own `announcements` (see `getClass`). |
| `createAnnouncement` | `POST /api/admin/announcements` | Body `{ title, body, audience, course, scheduled_at }` (`course` only when `audience = "course"`; `scheduled_at` null to publish immediately). **The only create endpoint this admin surface has** — every other Academics screen is read and delete only. Re-validates title/body non-empty and `course` present for a course audience, the same checks the UI runs; `status` becomes `Scheduled` if `scheduled_at` is in the future, else `Published` with `published_at` set server-side. |
| `deleteAnnouncements` | `POST /api/admin/announcements/delete` | Body `{ ids: [...] }`. Permanent, audit-logged. |

### Intelligence and the admin inbox

| `api.js` function | Endpoint | Notes |
|---|---|---|
| `getAiHealth` | `GET /api/admin/ai` | Not paginated — a health/usage overview. `{ requests_trend, usage_by_feature, feature_health, quota, toggles, transcription, quiz_generation }`. `requests_trend`/`usage_by_feature` mirror the dashboard's shapes (same numbers for the latest month, so the two pages agree). `feature_health[]` is `{ feature, label, avg_latency_ms, error_rate_pct }`. `transcription` is `{ queued, avg_processing_sec, failures: [{ id, title, class_name, owner_name, posted_at }] }`, derived from the content library's `Processing`/`Failed` rows. `quiz_generation` is `{ by_bloom, by_difficulty }`, each `[{ label, value }]` counted over AI-sourced quizzes only. `toggles` is `{ summarizer, planner, quiz_synthesizer, chat, language, daily_request_limit }` — the *same* object `getSettings`/`saveSettings` reads under its `ai` key, so `/ai` and `/settings/ai` can never disagree. (Verified against the mock: `scripts/check-api.mjs` flips a switch through `updateAiFeature` and reads it back through `getSettings`.) |
| `updateAiFeature` | `PUT /api/admin/ai/features/{feature}` | Body `{ enabled }`. One feature at a time, so a flaky toggle can't silently touch the others; the UI applies it optimistically and rolls back on a failed response. 404s with `NOT_FOUND` for an unknown feature key. |
| `getReports` | `GET /api/admin/reports` | Not paginated — a campus-wide analytics overview, exported and printed entirely on the client (`shared/utils/csv.js`, `window.print()`), so there is nothing server-side to build for either. `{ user_growth, engagement_trend, participation_by_course, content_consumption, struggling_concepts }`. `struggling_concepts[]` (`{ id, concept, course, avg_score_pct, students_affected }`) is a placeholder shape — once quizzes carry a concept/topic tag the real query aggregates low-scoring `QuizQuestion`s by that tag instead. |
| `getNotifications` | `GET /api/admin/notifications` | List conventions above. Filters: `read` (`true`/`false`). Row: `{ id, type, title, message, read, created_at }`, `type` one of `job` \| `storage` \| `security`. This is the admin's own inbox — failed background jobs, storage warnings and security alerts — not the mobile `Notification` type. |
| `markNotificationRead` | `PUT /api/admin/notifications/{id}/read` | Body `{ read }` — toggles either direction. |
| `markAllNotificationsRead` | `POST /api/admin/notifications/read-all` | Marks every row read; affects the signed-in admin's inbox only (there is one admin, so campus-wide and "mine" are the same today). |

`getNavCounts`'s `unread_notifications` must equal `getNotifications`'s unread row count — the mock
computes both from one table precisely so this can never drift once the real endpoints exist.

### Security center

| `api.js` function | Endpoint | Notes |
|---|---|---|
| `getAuditLog` | `GET /api/admin/security/audit-log` | List conventions above. Filters: `action` (`delete`\|`create`\|`update`\|`settings`\|`security`), `from`/`to` (dates, inclusive). Row: `{ id, actor, action, summary, at }`. Written by the server on every write this admin surface performs — every delete (`deleteUsers`, `deleteClasses`, `deleteContent`, `deleteAnnouncements`), every create (`createAnnouncement`), every settings save, every AI toggle, the admin password change, and every session revoke. There is one admin account today, so `actor` is always the same name; the column exists for when that changes. |
| `getSessions` | `GET /api/admin/security/sessions` | Not paginated — a handful of rows. Row: `{ id, device, browser, ip, location, started_at, last_active_at, current }`. `current` marks the session answering the request; the UI never offers to revoke it. |
| `revokeSession` | `POST /api/admin/security/sessions/{id}/revoke` | Invalidates that session's token/cookie server-side immediately. 404s with `NOT_FOUND` for an unknown id, 422s if the id is the caller's own current session. Audit-logged. |
| `getLoginAttempts` | `GET /api/admin/security/login-attempts` | List conventions above. Filters: `result` (`Success`\|`Failed`\|`Locked`). Row: `{ id, identifier, success, locked, stage, note, device, user_agent, ip, at }` — `stage` is `password` or `otp`, so the password step and the login-code step are both visible. Appended by the server on every `login`, `verifyLoginOtp` and `resendLoginOtp` call, success or failure — the same event `login`'s 429/401 responses are built from, so this list and the lockout behavior can never disagree. `identifier` is whatever the caller typed, not normalized — useful for spotting typosquatting/enumeration attempts. |
| `getVulnerabilities` | `GET /api/admin/security/vulnerabilities` | Not paginated. Row: `{ id, title, category, severity, description, recommendation }`, `severity` one of `Critical`\|`High`\|`Medium`\|`Low`. Read-only "scanner-style" findings — mock data today (master prompt, section 5: "Findings come from the API; use mock data now"); a real implementation would run actual checks (dependency audit, policy comparison, TLS/CSP probe, backup age) on a schedule and have this endpoint read the latest run. |

The endpoints for `/help` are omitted on purpose — it is static admin-facing content with no data
of its own, aside from reading `getSettings` for the app version already shown on `/settings/system`.

Every list in this section reuses the same `page/page_size/sort/order/q` + flat-filter conventions
as the rest of this document; nothing here is a special case.

### Production checklist for the admin bundle

- Delete `studia-admin/src/core/config/demoCredentials.js`. It is the only file in the app with a
  credential in it, it is read through `core/config/demo.js` with `import.meta.glob`, and the build
  succeeds with the file absent (verified).
- Build with `VITE_USE_MOCK=false`. That is what drops both the mock backend and the demo file from
  the bundle: `core/data/api.js` and `core/config/demo.js` compare the raw env value so Vite can
  tree-shake them. With the flag left at its default, the admin password ships in the JavaScript.
- Send the security headers from the web server as well as the `index.html` meta tags
  (`Content-Security-Policy`, `Referrer-Policy`, `X-Content-Type-Options`), since `frame-ancestors`
  is ignored in a meta tag.

## Assessment rules (server-enforced)

Migration `20260101000011_assessment_schedule.sql` is the database half of these; the API enforces
the rest. The mobile mock implements the same rules so the UI can be exercised without a server.

- **Time:** every late/closed decision uses the server's `now()`. Device clocks are never trusted.
- **Assignments:** `closes_at ≥ due_at` and only with `allow_late`; `points` ≥ the highest score
  already given; moving `due_at` re-tags `submitted`/`late`; a student can only read their own
  submission and the class owner reads all of them.
- **Quizzes:** `due_at`, `allow_late`, `closes_at` (≥ `due_at`, only with `allow_late`),
  `time_limit_min`. A submit after `due_at` is rejected unless `allow_late`, and always after
  `closes_at`; accepted late attempts get `late = true`. Questions freeze after the first attempt.
  Drafts are never visible to students (RLS `status = 'published'`).
- **Comments:** class members and the class owner may comment; the author or the class owner may
  delete.
- **Not built yet:** quiz `opens_at`, a per-attempt server `started_at` for the time limit, and
  `max_attempts > 1` in the student UI.

## Known gaps

### Mobile

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

### Admin

1. **The email domain is not agreed across the three places that define it.** The admin UI
   (`studia-admin/src/core/logic/validation.js`, `EMAIL_DOMAIN`) requires `@omsu.edu.ph`, per the
   product brief. The mobile app's `auth-validation.ts` applies **no** domain rule — any
   syntactically valid address passes — and its seeded demo accounts are `@omsc.edu.ph` (the
   campus's former name), which the admin rule would reject. **The server has to pick one and
   enforce it**; whichever it picks, the two clients must be brought in line with it. Until then,
   treat the admin's rule as a display-level hint, not a guarantee about what is in the table.
2. **No token persistence across a reload.** The access token lives in memory only (see
   *Token storage* above), so a refresh of the browser signs the admin out. The fix is the
   httpOnly refresh cookie plus `POST /api/admin/auth/refresh`, which `tokenStore` already has a
   hook for; nothing else in the client changes.
3. **CSV export and the print view are entirely client-side** (`shared/utils/csv.js`,
   `window.print()`), so they export exactly the rows currently on screen. If a report ever has to
   export *all* matching rows rather than the current page, that needs a server endpoint
   (`GET …?format=csv`) — none is specified today.
4. **`getVulnerabilities` is mock data by design** (master prompt, section 5). A real
   implementation runs the checks on a schedule and this endpoint reads the latest run; the row
   shape is the contract, the findings are not.
5. **`getAssessments`, `getAiHealth` and `getReports` are unpaginated** overviews. They are fine
   at campus scale; if any of them starts returning thousands of rows, it needs the same
   `page/page_size` treatment as the lists.
6. **One admin account.** `actor` in the audit log and `current` in the session list both assume
   it. Nothing in the UI breaks with several admins, but role checks would then need more than
   "is admin".
