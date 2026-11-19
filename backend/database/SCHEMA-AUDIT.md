# Schema audit — `studia-mobile` vs `studia-admin`

Companion to [`studia.db.sql`](studia.db.sql), the single MySQL file both clients share.

Both apps currently run on their own in-memory mocks, so nothing has forced them to agree. This
document lists **every place they disagree**, says **which side the shared schema follows**, and
names the change each client needs to make. Nothing in `studia-mobile/` or `studia-admin/` has been
edited — every "client change" below is a recommendation for whoever does that work.

Sources compared:

| Side | Files read |
|---|---|
| Mobile | `features/auth/data/auth-service.ts`, `features/auth/logic/auth-validation.ts`, `core/types/content.ts`, `features/{student,instructor,shared-screens}/types/*.ts`, every `features/*/data/*-repository.ts`, `features/*/data/class-directory.ts`, `shared/utils/file.ts` |
| Admin | `core/logic/validation.js`, `core/logic/mappers.js`, `core/data/mock/mockData.js`, `core/data/mock/mockBackend.js`, `core/config/demoCredentials.js` |
| Contract | `docs/api-contract.md` |

---

## Summary

26 findings. The ones that would break an import or silently corrupt data are marked **blocking**.

| # | Finding | Severity |
|---|---|---|
| 1 | Email domain: `@omsc.edu.ph` (mobile seeds) vs `@omsu.edu.ph` (admin rule) | **blocking** |
| 2 | User ids: opaque strings (mobile) vs integers 1–28 (admin) | **blocking** |
| 3 | Account status: `active`/`pending_approval` vs `Active`/`Inactive` — no overlap | **blocking** |
| 4 | Role values: `student` vs `Student` | high |
| 5 | Section: one label `"BSIT 3-A"` vs three fields `course`/`year`/`section` | high |
| 6 | `it314` is section 3-A to students and 3-B to instructors — in the same app | high |
| 7 | Class code: `"IT 321"` (mobile) vs `"BSIT301"` (admin generated) | medium |
| 8 | Enum case elsewhere: `ready`/`published`/`ai` vs `Ready`/`Published`/`AI` | high |
| 9 | Quiz question text: `prompt` (student) vs `text` (instructor) | high |
| 10 | Question type `mc` in the contract vs `multiple_choice` in both clients | low |
| 11 | `Material` (instructor) and `Lesson` (student) are the same row, modelled twice | medium |
| 12 | Assignment status `assigned` has no row to store it in | medium |
| 13 | The instructor `Submission` type cannot represent an assignment submission | **blocking** |
| 14 | `progress`, engagement and consumption have no stored source anywhere | high |
| 15 | Formatted strings stored as data: `sizeLabel`, `durationLabel`, `time: "2h"` | medium |
| 16 | Notifications: UI tokens as data, and two unrelated notification models | medium |
| 17 | Per-viewer facts stored as data: `authorIsMe`, session `current` | medium |
| 18 | "Struggling concepts" needs a tag no quiz question has | medium |
| 19 | Admin dashboard numbers are invented (1 284 users over 28 rows) | medium |
| 20 | Announcement caps: 100/2 000 (contract) vs 140/4 000 (admin `LIMITS`) | medium |
| 21 | Password and lockout policy defined in three places | low |
| 22 | OTP resend: 30 s (mobile) vs 60 s (admin settings) | medium |
| 23 | Upload whitelist and size caps differ between the two clients | medium |
| 24 | Instructor approval exists in mobile, was removed from admin | medium |
| 25 | Admin user ids are also *display* ids — the profile page URL leaks row order | low |
| 26 | Carried-over gaps: pagination, idempotency, token persistence | low |

---

## Findings

### 1. Email domain — **blocking**

- Admin: `core/logic/validation.js` sets `EMAIL_DOMAIN = 'omsu.edu.ph'` and `isCampusEmail()`
  rejects anything else. All 28 mock users are `@omsu.edu.ph`.
- Mobile: `auth-validation.ts` applies **no** domain rule, and the two seeded demo logins are
  `student@omsc.edu.ph` / `instructor@omsc.edu.ph` — the campus's former name, which the admin rule
  would reject.

A single `users.email` column cannot satisfy both. **The schema follows `@omsu.edu.ph`** (the
product brief) and enforces it **on registration only**, so existing rows are grandfathered. The
seed keeps the two `@omsc.edu.ph` demo accounts so the mobile app's demo logins still work against
a real server; they are commented as legacy and should be deleted before production.

*Client change:* add the domain check to `auth-validation.ts`, and re-seed the two demo accounts at
`@omsu.edu.ph`.

### 2. User id type — **blocking**

Mobile ids are opaque strings (`"u-seed-1"`, `"it321"`, `"quiz_it321_2"`) and
`core/logic/route-params.ts` validates their *shape* before use. Admin mock users are integers
(`id: i + 1`), `getUser(id)` compares numerically, and `buildClasses()` stores `instructorId` as a
number.

`users.id` is `VARCHAR(36)`. Sequential integers are also an enumeration leak: `/users/7` tells an
attacker there is a `/users/8`.

*Client change:* `studia-admin` must treat every id as an opaque string. The places that assume a
number are `mockBackend.js` (`getUser`, `deleteUsers`, `aiUsageFor(user.id * 5)`) and anything
sorting by `id`.

### 3. Account status — **blocking**

- Mobile: `status: "active" | "pending_approval"`.
- Admin: `status: 'Active' | 'Inactive'`, and the contract says there is no block action — inactive
  is "set by whatever makes an account inactive in the mobile app". Nothing in the mobile app sets it.

The two sets share **no** value. The schema stores the union, lowercase:
`ENUM('active','inactive','pending_approval')`.

*Client change:* mobile must learn to read `inactive` (treat as a refused login with a clear
message); admin must capitalise for display only, and decide what makes an account inactive —
today nothing does.

### 4. Role letter case

`"student" | "instructor"` (mobile `core/types/role.ts`) vs `'Student' | 'Instructor' | 'Admin'`
(admin rows and its `role` filter). Stored lowercase, with `admin` added so there is one accounts
table. Display capitalisation belongs in the admin UI, not the column.

### 5. Section: a label vs three fields

Mobile stores one string, `User.section = "BSIT 3-A"`, and `composeSection()` builds it. Admin
stores `course` + `year` + `section` separately and composes the same label for display. Admin is
right: the label cannot be filtered, and `course=BSIT&year=3&section=A` is the admin user list's
core feature.

The schema stores the three columns on both `users` and `classes` and **never** stores the label.
The API may still return a composed `section` string for the mobile client, so no mobile screen has
to change — but registration must send the three parts (it already collects them as three dropdowns).

### 6. `it314` has two different sections inside the mobile app

| File | `it314` section |
|---|---|
| `features/student/data/class-directory.ts` | `BSIT 3-A` |
| `features/instructor/data/class-directory.ts` | `BSIT 3-B` |

Same class id, two sections. The student and instructor directories also disagree about which
classes exist (`ge105` is student-only, `it322` instructor-only) and the student one carries
`teacher` as a **name string** with no instructor id. One `classes` row can only have one section:
the schema follows the student view (`it314` = BSIT 3-A) and gives every class an
`instructor_id` FK instead of a teacher name.

### 7. Class code format

Mobile `code` is the instructor's subject code (`"IT 321"`, `"GE 105"`). Admin generates
`${course}${year}0${n}` → `"BSIT301"`, `"BA-FM101"`. The admin list column and the mobile field are
the same concept, so the schema has one `classes.subject_code` holding the instructor's value. The
admin's generated format is a mock artefact; classes are created in the mobile app, so the admin
never mints a code.

Note the two **join**-code generators also differ: mobile's seeds are `[A-Z0-9]{6}` by hand, admin's
`joinCodeFor()` is deterministic base-36 and can emit leading zeros. Neither matters once the server
generates and guarantees uniqueness — which is what `uq_classes_join_code` enforces.

### 8. Enum case everywhere else

| Concept | Mobile | Admin | Stored |
|---|---|---|---|
| Material processing | `processing` / `ready` / `failed` | `Processing` / `Ready` / `Failed` | lowercase |
| Quiz status | `draft` / `published` | `Draft` / `Published` | lowercase |
| Quiz source | `manual` / `ai` | `Manual` / `AI` | lowercase |
| Severity | — | `Critical` / `High` / `Medium` / `Low` | lowercase |
| Bloom / Difficulty | `Remember`…, `Easy`… | same | **as-is** (both already agree) |

Bloom levels and difficulties are the one vocabulary the two apps already share exactly, so they
are stored capitalised, matching both.

### 9. Quiz question: `prompt` vs `text` — same field, two names

```ts
// features/student/types/student.ts
export type QuizQuestion = { id; type; prompt: string;  options; correctIndex; … rationale }
// features/instructor/types/instructor.ts
export type QuizQuestion = { id; type; text: string;    options; correctIndex; … }       // no rationale
```

Two types named the same, in the same app, for the same row. The instructor type also lacks
`rationale` (which the student sees after submitting) and the student type lacks nothing the
instructor needs. The column is `quiz_questions.prompt`.

*Client change:* rename the instructor type's `text` to `prompt` and let both re-export one type
from `core/types/`, the way `Attachment` and `Comment` already do.

### 10. `mc` vs `multiple_choice`

`docs/api-contract.md` says question kinds are "`mc` (one `correctIndex`), `identification`,
`essay`". Both clients actually use `multiple_choice`. The contract line is wrong; the schema uses
`multiple_choice`.

### 11. `Material` and `Lesson` are one row modelled twice

Instructor `Material` and student `Lesson` have identical ids, classId, title, kind,
durationLabel, attachment, processing and transcript. They differ only in the AI field —
`objectives: string[]` for the instructor, `aiSummary: { tldr, bullets }` for the student — and the
admin's content row adds `sizeBytes`, `ownerId`, `className`.

One `materials` table serves all three, with `material_objectives` and `material_summaries`
alongside. They are projections of one row, not three entities.

### 12. Assignment status `assigned` has nothing to store

`SubmissionStatus = "assigned" | "draft" | "submitted" | "late" | "graded"` is stored on the mobile
`Assignment` itself, together with `submittedAt`, `submissionText`, `submissionFile`, `score` and
`feedback` — i.e. one student's submission is flattened onto the shared assignment record. That
works for a single-user mock and breaks the moment two students exist.

The schema splits it: `assignments` (shared) + `assignment_submissions` (per student).
`assigned` is simply **the absence of a submission row**, so it is not in the status enum.

### 13. The instructor `Submission` type cannot hold an assignment submission — **blocking**

```ts
export type Submission = {
  id; studentName: string;  classCode: string;
  quizId: string; quizTitle: string;        // ← required, so this is a quiz row by construction
  submittedAt; maxScore; score; gradedAt; feedback; answers: { prompt; response }[];
};
```

`submissions-repository.ts` is documented as the "gradebook source of truth", but every row must
belong to a quiz. Assignments are created (`InstructorAssignment`) and submitted to
(`Assignment.attach`/`turnIn`) with **no instructor-side path to grade them**. Meanwhile the admin's
assessments page reports `avg_submission_rate` for assignments as if that path existed.

There is also no `studentId` — only `studentName`, so two students with the same name are one row,
and a graded submission cannot be linked back to an account.

The schema keeps `quiz_attempts` and `assignment_submissions` separate, both with a `student_id` FK.
`GET /instructor/submissions` must UNION them.

*Client change:* add `studentId` to `Submission`, and either widen it with a
`kind: "quiz" | "assignment"` + nullable `quizId`, or add a second repository for assignment grading.

### 14. `progress` and every engagement number have no source

`progress: number // 0..1` appears on `StudentClass`, `ClassStudent` and the admin's class roster;
engagement %, content-consumption rates and `activeToday` appear on the instructor analytics and
admin dashboard. **Nothing in either client records that a student opened a material.** The mobile
mock hard-codes `PROGRESS = { it321: 0.7, … }`; the admin derives its numbers from the row index.

Fixed in the schema by `material_views`, with the formulas written in the table comment:

```
class progress   = completed materials / total materials of the class
engagement %     = students with a view in the last 7 days / enrolled
consumption rate = views / enrolled;  completion = completed / views
```

`class_enrollments.progress_pct` caches the first one (0..100, so divide by 100 for the clients'
0..1 scale). Nothing a client sends may set it.

*Client change:* the mobile app has to report views — a `POST /student/materials/{id}/view` on open
and on progress, or every one of these numbers stays decorative.

### 15. Formatted strings stored as data

`Attachment.sizeLabel: "2.4 MB"`, `Lesson.durationLabel: "18:24"`,
`NotificationItem.time: "2h"`, `backup.lastBackupSizeLabel: "1.8 GB"`, `restorePoints[].sizeLabel`.
A label cannot be sorted, summed or compared, and the admin content list needs to sort by size.

Stored numerically: `files.size_bytes`, `materials.duration_sec`, `backup_runs.size_bytes`, and
timestamps as `DATETIME`. `formatFileSize()` already exists in `shared/utils/file.ts` — keep the
formatting there.

### 16. Notifications: UI tokens as data, and two unrelated models

```ts
export type NotificationItem = {
  id; icon: IconName; title; meta; time; unread; tone: Tone; tag: NotificationTag;
};
```

`icon` (`"megaphone-outline"`) and `tone` (`"primary"`) are **presentation**, imported from
`shared/components/ui/icon` and `shared/constants/studia-colors`. Putting them in the payload means
a palette change becomes a database migration, and `time: "2h"` cannot be re-rendered after a minute
passes. `tag` is the only part that is real data.

Separately, the admin inbox is a different type entirely (`type: 'job' | 'storage' | 'security'`,
`read`, `createdAt`, `message`) and the contract notes it is "not the mobile `Notification` type".

One `notifications` table holds both, keyed by `user_id`, with a `kind` enum covering the union of
the two vocabularies, plus `link_route` + `link_params` for the deep link and `read_at` for state.
`icon` and `tone` are derived from `kind` by each client. The admin's `unread_notifications` badge is
`COUNT(*) WHERE user_id = <admin> AND read_at IS NULL` over these same rows.

### 17. Per-viewer facts stored as data

`Comment.authorIsMe` and the admin session list's `current` depend on **who is asking**, so they
cannot be columns — two viewers would need two different rows. The schema stores `author_id` and the
session id; each is compared to the caller per request. Same for `Task.done`, which is "a submission
exists" for most rows (see `student_task_overrides` for the few that are a real tick).

### 18. "Struggling concepts" needs a tag that does not exist

`getReports().struggling_concepts` and the instructor's `ConceptStruggle` both group quiz results by
concept, but `QuizQuestion` has no concept or topic field on either side, so both are hard-coded
lists. `quiz_questions.concept` is in the schema and nullable; until something fills it, that report
stays mock data. The seed fills it for the eight seeded questions to show the shape.

### 19. Admin dashboard numbers are invented

`mockStats` claims 1 284 users, 1 196 students, 86 classes and 2 340 AI requests over a mock list of
28 users and 16 classes; `mockCourseDistribution` is hand-tuned to sum to 1 196. None of it can
survive contact with a real table.

Every one of those tiles has to become a query — `COUNT(*)` on `users`, `classes`,
`ai_requests` — and the dashboard's `activity` feed, which is today a hard-coded array independent
of the user list, has to be assembled from `audit_log`, `users.created_at`, `ai_requests` and
`materials.posted_at`.

### 20. Announcement caps disagree

| Source | Title | Body |
|---|---|---|
| `docs/api-contract.md` (class announcements) | 100 | 2 000 |
| Admin `LIMITS.announcementTitle` / `announcementBody` | 140 | 4 000 |

They are two different tables, so both caps can stand — and the schema keeps them:
`announcements` (class, instructor-written) is `VARCHAR(100)`/`VARCHAR(2000)`,
`platform_announcements` (campus-wide, admin-written) is `VARCHAR(140)`/`VARCHAR(4000)`. Worth
deciding on purpose rather than by accident: a title that fits one form and not the other is a
confusing error message.

### 21. Password and lockout policy lives in three places

`auth-validation.ts` `PASSWORD_RULES`, `validation.js` `PASSWORD_RULES` (a deliberate port) and
`mockSettings.securityPolicy` (`minPasswordLength: 8`, `requireUppercase`, …). All three currently
agree, including `LOGIN_MAX_FAILS = 5` and `LOGIN_LOCK_MS = 60 s` ↔ `lockoutMinutes: 1`.

The `settings` table's `security_policy` row is the authority; the two client copies stay as fast
feedback only. Keep them in step, and note that the admin UI shows the five rules as a checklist
while `passwordScore()` also exists as a 0–4 score — only the checklist is used.

### 22. OTP resend interval

Mobile `OTP_RESEND_MS = 30_000`; admin `mockSettings.email.resendSeconds = 60`. Both describe the
same throttle on the same endpoint. The schema seeds `resend_seconds: 30` (the stricter client wins,
and it is what the mobile UI counts down from).

`otpExpiryMinutes: 5` matches mobile's `OTP_TTL_MS` — those already agree.

### 23. Upload whitelist and size caps

| | Mobile (`shared/utils/file.ts` + `logic/validators.ts`) | Admin (`mockSettings.uploads`) |
|---|---|---|
| Types | pdf, doc, docx, ppt, pptx, mp4, mov, jpg, jpeg, png | mp4, mov, pdf, pptx, docx |
| Caps | 500 MB materials, **50 MB** submissions | 500 MB video, **25 MB** document |

The admin list silently forbids `ppt`, `doc` and images that the mobile picker accepts, and its
document cap is half the mobile submission cap. The seeded `uploads` setting is the union of the
types and the mobile caps, split into `max_material_size_mb` / `max_submission_size_mb` — the admin's
single "document" cap cannot express the two different limits the mobile app enforces.

### 24. Instructor approval: present in mobile, removed from admin

`auth-service.ts` has `REQUIRE_INSTRUCTOR_APPROVAL` (off) and a `pending_approval` status, with the
comment that self-registration as an instructor is a privilege escalation. The admin surface has no
approval screen at all — the contract states "No `pending` counter — the approval flow is gone".

So an instructor can self-register into a role that can create classes, and no admin screen can stop
it. The status is in the schema; the approval screen is not built. Decide deliberately: either turn
the flag on and build the admin screen, or document that any `@omsu.edu.ph` address may become an
instructor.

### 25. Numeric ids are also display ids

Admin routes are `/users/:id` with the integer. Beyond finding 2, this exposes registration order
and row count. Opaque ids fix it for free.

### 26. Carried-over gaps (no schema impact, listed so they are not forgotten)

- **Pagination**: no repository method on the mobile side takes a cursor; every admin list already
  sends `page`/`page_size`. The indexes in the schema (`ix_*_created`, `ix_*_at`) are the ones those
  queries need.
- **Idempotency**: the contract marks eight writes "Needs Idempotency-Key" but no mobile repository
  signature accepts one. `idempotency_keys` is ready for it.
- **Token persistence**: neither client persists a token (mobile keeps the user in memory, admin
  keeps the token in memory only). `sessions` holds the server half; `expo-secure-store` and an
  httpOnly refresh cookie are the client halves.

---

## What each client has to change

Nothing below has been done — this file and `studia.db.sql` are the only two files added.

**`studia-mobile`**
1. Send `course` + `year` + `section` separately on register (it already collects three dropdowns).
2. Enforce the `@omsu.edu.ph` domain in `auth-validation.ts`; re-seed the demo accounts.
3. Rename the instructor `QuizQuestion.text` → `prompt`; move the type to `core/types/`.
4. Add `studentId` to `Submission`, and a path for grading assignment submissions.
5. Report material views, or every progress and engagement number stays decorative.
6. Drop `icon`/`tone`/`time` from `NotificationItem`'s data and derive them from `kind` + `createdAt`.
7. Read `status: "inactive"` as a refused login.
8. Treat `Attachment.sizeLabel` / `durationLabel` as client-side formatting of bytes and seconds.

**`studia-admin`**
1. Treat every id as an opaque string (`mockBackend.js` `getUser`, `deleteUsers`, `aiUsageFor`).
2. Capitalise `status`, `role`, `processing`, quiz `status`/`source` and `severity` for display only.
3. Turn `mockStats`, `mockCourseDistribution` and the `activity` feed into queries.
4. Split the single uploads "document" cap into material and submission caps.
5. Set `resendSeconds` to 30, matching the mobile countdown.
6. Decide what sets an account `Inactive`, since nothing does today.

**`docs/api-contract.md`**
- Fix `mc` → `multiple_choice`.
- Record the chosen email domain, and that `GET /instructor/submissions` is a union of quiz
  attempts and assignment submissions.

---

## Table map

Which table answers which client call. Mobile repositories are `features/<role>/data/*`;
admin functions are `core/data/api.js`.

| Table | Serves |
|---|---|
| `users` | all `/auth/*`, admin `getUsers`/`getUser`/`deleteUsers`, `ClassStudentRepository` |
| `otp_codes`, `auth_tokens` | `resendOtp`, `verifyOtp`, password reset, admin `sendOtp`/`verifyOtp` |
| `sessions` | admin `getSessions`/`revokeSession`; mobile token persistence |
| `login_attempts` | admin `getLoginAttempts`; the lockout decision for both apps |
| `files` | every `Attachment`, material upload, assignment submission |
| `classes` | `ClassRepository`, `InstructorClassRepository`, admin `getClasses`/`getClass` |
| `class_enrollments` | `joinByCode`, `leave`, `listByClass` students, admin class roster |
| `announcements`, `announcement_comments` | both announcement repositories, admin `getClass().announcements` |
| `materials` + transcript/objectives/summaries | `LessonRepository`, `MaterialRepository`, admin `getContent` |
| `material_views` | all `progress`, `useAnalytics`, admin `content_consumption`, `activeToday` |
| `assignments`, `assignment_attachments`, `assignment_submissions` | both assignment repositories, admin `getAssessments` |
| `quizzes`, `quiz_questions`, `quiz_options` | both quiz repositories, admin `getAssessments`, `getAiHealth().quiz_generation` |
| `quiz_attempts`, `quiz_answers` | `submitAttempt`, `SubmissionRepository`, `useGradeSubmission` |
| `student_task_overrides` | `TaskRepository.toggleDone` (the list itself is derived) |
| `planner_weeks`, `planner_blocks`, `planner_exams` | `PlannerRepository` |
| `notifications` | `NotificationRepository`, admin `getNotifications` + `getNavCounts` |
| `platform_announcements` | admin `getAnnouncements`/`createAnnouncement`/`deleteAnnouncements` |
| `ai_requests`, `ai_chat_messages` | `POST /ai/*`, admin `getAiHealth`, dashboard `ai_usage`, a user's `ai_usage` |
| `settings` | admin `getSettings`/`saveSettings`, `getAiHealth().toggles`, `updateAiFeature` |
| `audit_log` | admin `getAuditLog`; written on every admin write |
| `backup_runs` | admin `runBackup`, `settings.backup.restore_points` |
| `security_findings` | admin `getVulnerabilities` |
| `idempotency_keys` | every write the contract marks "Needs Idempotency-Key" |

Not a table: `GET /student/tasks` (derived), `GET /api/admin/dashboard`, `/reports`, `/ai`
(aggregates), `getNavCounts` (a `COUNT` over `notifications`).

---

## Importing

```
1. XAMPP Control Panel → start MySQL
2. phpMyAdmin → Import → choose backend/database/studia.db.sql → Go
   (or: C:\xampp\mysql\bin\mysql.exe -u root < backend\database\studia.db.sql)
3. backend/.env:  DB_HOST=127.0.0.1  DB_NAME=studia  DB_USER=root  DB_PASS=
```

The file creates the `studia` database itself and drops every table first, so re-importing always
gives the same state.

Verified by importing it into a throwaway database on MariaDB 10.4.32 (the XAMPP build on this
machine): 36 tables, 49 foreign keys, ~253 seed rows, no errors. All 49 foreign keys were then
re-checked for orphan rows (none), every JSON column parses, every `multiple_choice`
`correct_index` is within its option count, and `class_enrollments.progress_pct` equals the value
the finding-14 formula computes from `material_views` on all 14 enrolments.

Seed logins: `admin@omsu.edu.ph` (or `admin`) / `Studia@2026`, `student@omsc.edu.ph` /
`Student@123`, `instructor@omsc.edu.ph` / `Instructor@123`. The hashes are real bcrypt (cost 12);
regenerate them with `php -r "echo password_hash('…', PASSWORD_ARGON2ID);"` and delete the demo rows
before this leaves the campus network.
