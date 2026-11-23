# Admin ↔ Mobile ↔ Supabase sync report

> Petsa: 2026-11-23. Branch: `claude/studia-mobile-admin-sync-lbytfc`.
> Sinuri: `studia-mobile/src`, `studia-admin/src`, `studia-api/`, `supabase/migrations` 001–020, at ang **live na Supabase** (read-only na queries sa Management API). Hindi pinatakbo ang mobile app sa device.

## Buod

1. **Mobile**: naka-connect na sa Supabase ang quizzes, account/auth, grading feedback, class announcements at replies, at AI chat. Dalawa ang tunay na butas: **profile photo (device lang)** at **ang live DB na kulang ng migrations 018–020**.
2. **Live DB**: ang mobile ay nakaturo sa `studia-dev` (`chvibqjstucybirsmpwu`) sa lahat ng tatlong EAS profile, kasama ang `production`. Ang `studia-dev` ay may 17 sa 20 migrations. Ang `studia-prod` ay may 7 lang at walang laman.
3. **Admin**: ang login lang ang totoong Supabase. Lahat ng pages ay mock pa rin (`core/data/mock/mockBackend.js`). Wala pa itong epekto sa mobile.
4. **Ginawa na sa admin**: tinanggal ang Academic term, Uploads at Vulnerabilities, at ginawang class-stream moderation ang Announcements para tugma sa mobile.
5. **DB**: may migration na `021` (hindi pa naka-apply) para sa mga dapat burahin. Walang bagong table na kailangan. Ang kulang ay ang pag-apply ng 018–020.

---

## 1. Mobile: ano ang naka-connect sa database

| Bahagi | Table / RPC | Status |
|---|---|---|
| Quizzes (student: kuha, sagot, resulta) | `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_answers`, RPC `submit_quiz` | Connected |
| Quizzes (instructor: gawa, i-grade) | RPC `save_quiz`, `grade_quiz_attempt`, `quiz_question_keys` | Connected |
| Account: register, login, OTP, Google | Supabase Auth + `studia-api` (`api/auth/*`), `users`, `otp_codes` | Connected |
| Account: edit profile, password | `studia-api` `api/me/profile-update`, `password-change` | Connected |
| Account: profile photo | `studia-api` `POST /api/me/avatar` → `avatars` bucket + `users.avatar_path` | Connected na (dating device lang). Hindi pa na-test sa device |
| Feedback sa assignment | RPC `grade_assignment` (`feedback`), `assignment_submissions` | Connected |
| Feedback sa quiz | RPC `grade_quiz_attempt` (`feedback`) | Connected |
| **Feedback sa app/admin** (user nagpapadala) | Walang screen, walang table | **Wala sa app** |
| Class announcements (stream) | `announcements` | Connected |
| Replies / comments sa announcement | `announcement_comments` (insert, delete) | Connected |
| AI chat (tanong at sagot) | `studia-api` `POST /api/ai/chat` → `ai_chat_messages`, `ai_requests` | Connected sa code. Tingnan ang #3 sa ibaba |
| AI quiz generator, summary | `studia-api` `api/ai/quiz`, `api/ai/summarize` | Connected sa code |
| Classes, join/leave/delete | `classes`, `class_enrollments`, RPC `join_class`, `leave_class`, `delete_class` | Connected |
| Assignments at submissions (kasama ang file) | `assignments`, `assignment_submissions`, `assignment_attachments`, RPC `submit_assignment` | Connected |
| Materials, lessons, views | `materials`, `material_*`, `material_views`, `files` | Connected |
| Planner, tasks | `planner_weeks/blocks/exams`, `student_task_overrides` | Connected |
| Notifications (inbox) | `notifications` (+ Realtime) | Connected, pero tingnan ang #2 |
| Push token | RPC `register_push_token`, `unregister_push_token`, `push_tokens` | **Hindi gagana sa dev DB.** Tingnan ang #2 |

### Mga nakita sa live DB (`studia-dev`)

**#2. Kulang ang migrations 018, 019, 020.** Naka-apply lang ang 001–017.

| Migration | Epekto sa mobile ngayon |
|---|---|
| 018 realtime notifications | Hindi realtime ang bagong notification |
| 019 push notifications | Walang `push_tokens` table at walang `register_push_token`/`unregister_push_token`. Papalya ang pag-register ng push token |
| 020 edit submission | Luma ang `submit_assignment`, kaya hindi gagana ang pag-edit ng submission ayon sa bagong code |

Ayusin: `supabase db push` sa `studia-dev` (isasama nito ang 021 kung hindi mo ito ihihiwalay).

**#3. AI chat.** Sa `ai_requests`: chat 2 ok at 3 `AI_UNAVAILABLE`; summarizer 2 ok, 5 error. Pero `ai_chat_messages` ay **0 rows** kahit may "ok" na chat request. Hindi ko matukoy kung ni-clear lang ang sample data o hindi sumusulat ang endpoint. Hindi ko rin ma-reach ang `studia-api-mu.vercel.app` mula sa sandbox na ito, kaya hindi ko na-verify kung naka-deploy at may `AI_API_KEY`. I-test sa device.

**#4. `production` EAS profile ay nakaturo sa `studia-dev`.** Lahat ng Supabase URL sa `eas.json` ay `chvibqjstucybirsmpwu`. Ang `studia-prod` (`xvjahswctcarvblxgjmd`) ay may 7 migrations at walang data. Dapat itong i-migrate bago ang totoong release.

---

## 2. Admin: tinanggal na

| Tinanggal | Ano ang ginawa |
|---|---|
| Settings > **Academic term** (semester) | Binura ang `Term.jsx`, route, nav item, mock settings. Hindi ginagamit ng mobile ang semester o school year |
| Settings > **Uploads** | Binura ang `Uploads.jsx`, route, nav item, mock settings |
| Security > **Vulnerabilities** | Binura ang page, route, nav item, mock data, `getVulnerabilities` sa API/HTTP/mock, CSS, at Help entry. Inalis din sa Security center ang "Posture findings" at "High severity" cards |
| System-wide announcement composer | Binura ang `CreateAnnouncementModal.jsx` at `createAnnouncement`. Walang ganito sa mobile |

Nakumpirma: `npm run lint` at `npm run build` ay malinis (studia-admin).

### Tinanggal din (kasunod na utos)

| Tinanggal | Ano ang ginawa |
|---|---|
| Security > **Sessions** | Binura ang page, route, nav, `getSessions`/`revokeSession`, at ang Active sessions card. Pinalitan ng Lockouts card ang Security center |
| Settings > **Backup** | Binura ang page, route, nav, `runBackup` |
| Settings > **Security policy**, **Email & OTP** | Binura ang pages, routes, nav |

**Ibinalik** ang Settings > System (maintenance), kasama ang banner, state at logic, kasunod ng utos mo. Natira sa Settings: AI, System, Legal, Account. Natira sa Security: Audit log, Login attempts. Ang mock `email` (OTP resend) at `system.appVersion` ay iniwan dahil ginagamit ng Account at Help. Hindi ko pa binura ang mga table na `sessions` at `backup_runs`; hindi ito kasama sa migration 021. Sabihin kung isasama.

---|---|---|
| Security > **Sessions** | Supabase Auth ang session ng mobile at admin; walang nagsusulat sa `sessions` (0 rows) | `sessions` |
| Settings > **Backup** | Walang backup job sa repo; Supabase ang may backup. May 4 na `backup_runs` rows sa dev | `backup_runs` |
| Settings > **Security policy**, **Email & OTP** | Hardcoded ang mobile; walang `from("settings")` sa app, kaya walang epekto ang admin | `settings` |
| Settings > **System** (maintenance) | Walang mobile gate; hinaharang din ng RLS ang `system` section | `settings` |

---

## 3. Announcements: tab na tugma sa mobile

Sa mobile, nasa **loob ng class** ang announcements (stream: title, body, pinned, comments). Dating system-wide notice ang admin page (`platform_announcements`) na hindi binabasa ng mobile. Ngayon:

- Sidebar > Academics > **Announcements** ay nagpapakita ng class stream posts: Announcement, Class (+ section), Posted by, Pinned, Comments, Posted.
- May **View** na bubukas ng post kasama ang mga comment, tulad ng nakikita ng student.
- May search (title, message, class, instructor) at Pinned filter. Read at delete lang; instructor pa rin ang nagpo-post sa app.
- Ang Class detail ay may Announcements card na ring ganito ang shape.
- Mock lang ito. Para sa totoong data, kailangan ng `studia-api` endpoint na gumagamit ng service role (tingnan sa ibaba).

## 4. Mga table sa Supabase

### Buburahin (`supabase/migrations/20260101000021_admin_mobile_sync.sql`, **naka-apply na sa `studia-dev`**; wala pa sa `studia-prod`)

| Item | Dahilan | Datos na mawawala (dev) |
|---|---|---|
| `security_findings` table at `severity_level` type | Tinanggal ang Vulnerabilities page; walang scanner | 0 rows |
| `platform_announcements` table, `announcement_audience`, `announcement_status` types | Class stream lang ang announcements ng mobile | 1 row |
| `settings` rows `term` at `uploads` | Tinanggal ang dalawang page; hindi binabasa ng mobile | 2 rows |
| `classes.school_year`, `classes.semester` | Hindi ipinapadala ng mobile (laging null) | wala |

Sinuri sa live DB na walang policy, view o function na umaasa sa mga ito. Tala: mananatili ang enum labels na `term` at `uploads` sa `settings_section`, dahil hindi nakakapag-drop ng enum value ang Postgres nang hindi ni-rebuild ang type. Wala itong epekto.

Na-regenerate na ang `shared-types/database.types.ts` mula sa dev DB, at inalis ang dalawang entry sa `scripts/src/lib/plan.ts`.

### Idadagdag

- **Walang bagong table na kailangan** para sa kasalukuyang admin at mobile. Ang `push_tokens` (019) ay nasa repo na; hindi lang naka-apply.
- Kung gusto mo ng **feedback** mula sa user papunta sa admin, wala pang ganoon sa mobile o admin. Kailangan ng bagong `app_feedback` table (user_id, kind, message, created_at), mobile screen, at admin page. Sabihin kung gusto mo.

### Para magkaroon ng totoong data ang admin

Sinasabi ng migration 008: *"admin has NO direct data access: the admin dashboard goes through studia-api with the service role."* Kaya ang kailangan ay mga `/api/admin/*` endpoint sa `studia-api` (users, classes, announcements, content, assessments, reports, audit log). Wala pa ang mga ito, at hindi ko ito ginawa.

## 5. Ano ang hindi ko ginawa

- Hindi ko in-apply ang 018–021 sa Supabase. Production-adjacent na DB ito (ang production EAS profile ay nakaturo rito), at may drop ng table.
- Hindi ko ginalaw ang profile photo (device lang) sa mobile.
- Hindi ko na-test ang admin sa browser: ang login ay totoong Supabase, kaya hindi ako makapasok. In-verify ko ang bagong mock sa pamamagitan ng direktang pag-load ng `mockBackend` (filter, search, class detail) at ng build at lint.

## 6. Campus-wide announcements (migration 022, naka-apply sa `studia-dev`)

- Admin > Announcements ay may dalawang tab: **Class stream** (moderation) at **Campus-wide** (composer at listahan ng naipadala).
- Ang admin ay nag-i-insert at nagbubura sa `platform_announcements` gamit ang sarili niyang Supabase session. Admin lang ang pinapayagan ng RLS (migrations 022 at 024; ang 023 ay naibalik ng 024). Sinubukan: bawal ang student, pasok ang admin.
- Ang trigger ay gumagawa ng `notifications` row (kind `notice`) para sa bawat active na student at instructor ayon sa audience (lahat, students, instructors, o isang course), at nagsusulat sa `audit_log`. Lumalabas ito sa Alerts tab at sa push (migration 019, kapag naka-set ang send-push). Walang pagbabago sa mobile.
- Sinubukan sa dev (na-rollback ang test): lahat = 7 recipients, students = 6, BSIT = 1.
- Immediate send lang; walang scheduling. Max 500 characters ang mensahe.
