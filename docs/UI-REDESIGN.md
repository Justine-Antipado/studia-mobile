# Studia Mobile — Final UI/UX Redesign Spec

**Petsa:** 2026-11-28
**Saklaw:** `studia-mobile` (student + instructor), kasama ang kinakailangang pagbabago sa `studia-api` at
`supabase/migrations` para sa AI features.
**Paraan:** Fresh code audit — binasa ang kasalukuyang source nang direkta (4 parallel na pass: student
screens, instructor screens, shared/core infra, AI+database). Hindi ito extension ng `docs/UI-FLOW-AUDIT.md`
o `studia-mobile/audit.md` — ginamit lang sila bilang pointer para alamin kung saan tumingin, pero bawat
claim dito ay na-verify laban sa totoong code ngayong araw. Kung saan sila nagkaiba sa totoong code, nakasulat
dito nang malinaw.
**Hindi tinest sa device/emulator.** Static code review lang.

---

## 0. Mahahalagang pagwawasto bago lahat

Tatlong umiiral na dokumento ang may lumang/maling claim tungkol sa AI. Dapat ayusin ang mga ito kapag
na-implement na ang mga pagbabago sa seksyon 5:

| Dokumento | Sinabi | Totoo sa code ngayon |
|---|---|---|
| `CLAUDE.md` | "AI features... have no backend yet. They report that they are unavailable" | Mali na. Naka-connect na ang AI chat, AI quiz generator, at AI summarizer sa `studia-api` (Vercel) + Gemini, mula pa noong 2026-11-23. Walang binanggit na `studia-api/` o `supabase/` sa `CLAUDE.md` kahit pareho itong totoong, aktibong bahagi ng monorepo. |
| `docs/api-contract.md:318` | `POST /ai/quiz` → `{ sourceId, count, difficulty, bloomLevels }` | Mali. Ang totoong endpoint (`studia-api/src/ai/quiz.ts`) ay `{ topic: string, count, difficulty }` — **walang `sourceId`**. Walang Bloom-level input mula sa instructor; bumabalik lang ito per-question mula sa AI. |
| `docs/api-contract.md:319` | `POST /ai/chat` → `{ messages }`, streaming preferred | Mali. Ang totoo ay `{ threadId?, message, history? }`, hindi streaming, at `history` ay tinatanggap pero **hindi ginagamit** (sinasadya — binabasa ng server ang sariling nakatagong history gamit ang `threadId`). |
| `docs/ROUTE-MAP.md:79` | Student AI tab segments: "Chat · Summarizer · Practice" | Mali. Isa lang na chat screen ang AI tab ngayon (`ai-assistant-screen.tsx`). Summarizer ay nasa loob ng bawat lesson (`lesson-viewer-screen.tsx`), hindi sa AI tab. |
| `docs/UI-FLOW-AUDIT.md` | Sinasabing "5 filters" sa To-do dapat gawing 3 (Assigned/Missing/Done), at ang Grades tab ng student ay dapat tanggalin | Hindi pa nangyari ang alinman. Totoo pa rin ang mungkahi (tingnan seksyon 2), pero kasalukuyang estado ay 5 filters at Grades tab ay nandon pa. |

Itong dokumentong ito (`UI-REDESIGN.md`) ang dapat sundin mula ngayon para sa AI architecture. Hindi ito
pinapalitan ang `UI-FLOW-AUDIT.md`'s flow-merge suggestions — nirereconfirm o niriresolba lang ang bawat isa
laban sa totoong code (tingnan seksyon 2).

---

## 1. Kasalukuyang estado — beripikadong natuklasan

### 1.1 Student

| # | Natuklasan | Klase | File |
|---|---|---|---|
| S1 | Home's "Today's tasks" + "Upcoming deadlines" ay dalawang seksyon na **parehong** `useTasks()` list lang, hinati-hati lang — hindi lang visual duplication, literal na parehong data source | Redundancy | [home-screen.tsx](../studia-mobile/src/features/student/screens/home-screen.tsx) |
| S2 | To-do tab ay ang **parehong** `useTasks()` list ng Home, may 5-way filter (All/Today/Upcoming/Overdue/Done) | Redundancy | [todo-screen.tsx](../studia-mobile/src/features/student/screens/todo-screen.tsx), [task-filters.ts:6](../studia-mobile/src/features/student/logic/task-filters.ts#L6) |
| S3 | Course-detail "Tasks" tab ay **ibang data path** (`useAssignments(classId)` + `useQuizzes(classId)`), may duplicated status-label/tone constants na muling lumalabas sa `assignment-detail-screen.tsx` | Redundancy + duplicate code | [tasks-tab.tsx](../studia-mobile/src/features/student/components/course-detail/tasks-tab.tsx) |
| S4 | Confirmed: Home, To-do tab, at bawat class's Tasks tab = **tatlong UI** na nagpapakita ng parehong uri ng gawain, galing sa **dalawang** magkaibang hook/repository | Redundancy | — |
| S5 | Planner's AddPlanSheet title field ay walang `maxLength` — ang lahat ng ibang text field sa app ay may cap | Form gap (minor) | [add-plan-sheet.tsx](../studia-mobile/src/features/student/components/add-plan-sheet.tsx), cf. [validators.ts:31,37](../studia-mobile/src/features/student/logic/validators.ts#L31) |
| S6 | Home Quick Actions (My Courses/To-do/Planner/AI Assistant) ay 1:1 redundant sa 5-tab bottom bar — walang idinagdag na value | Redundancy | [home-screen.tsx](../studia-mobile/src/features/student/screens/home-screen.tsx) |
| S7 | Home's "Upcoming deadlines" row ay pumupunta sa generic To-do tab, hindi sa specific na task — dagdag na hakbang na kailangan pang maghanap | Flow bug | [home-screen.tsx:153](../studia-mobile/src/features/student/screens/home-screen.tsx#L153) |
| S8 | Student Grades tab (course-detail) ay **nandon pa rin** — hindi natanggal gaya ng iminungkahi ng `UI-FLOW-AUDIT.md` | Stale doc, hindi bug | [course-detail-screen.tsx:16,47](../studia-mobile/src/features/student/screens/course-detail-screen.tsx#L16) |
| S9 | **(Naayos na, 2026-11-28)** To-do at Planner ay parehong `student_tasks` view, pero ang pag-submit ng assignment/quiz ay nag-invalidate lang ng `tasks` cache, **hindi** ng `planner` (persisted pa sa disk). Kaya naka-unchecked pa rin sa Planner ang na-submit na gawain; pag-tap → `"Already completed via submission."` error at bumabalik sa unchecked. Ghost rows mula sa lumang cache → `"This task no longer exists."` na red toast. **Fix:** submit ay nag-invalidate na rin ng `planner`; bagong `submitted` flag sa `Task`/`PlannerBlock` (naka-lock ang check, "Submitted" badge, tap = buksan ang gawain); `toggleDone` sa submitted task ay tahimik na `ok` na; ghost rows ay tahimik na tinatanggal + refresh ng parehong list | Bug (naayos) | [use-assignments.ts](../studia-mobile/src/features/student/hooks/use-assignments.ts), [use-quizzes.ts](../studia-mobile/src/features/student/hooks/use-quizzes.ts), [tasks-remote.ts](../studia-mobile/src/features/student/data/tasks-remote.ts), [use-tasks.ts](../studia-mobile/src/features/student/hooks/use-tasks.ts), [planner-screen.tsx](../studia-mobile/src/features/student/screens/planner-screen.tsx) |

**Mahalagang kabaligtaran:** Ang mga sumusunod na form ay **mahusay** na ginawa — dirty-check/confirm-discard,
validation, loading-lock, draft/resubmit states: **Assignment detail** (pinakamahusay sa buong app),
**Quiz take** (resumable server-clock countdown), **Join class**, **Announcement comments**. Ang "fix form
logic" na hiling ng user ay **hindi** totoo sa lahat ng form sa student side — ang totoong problema ay ang
*redundancy ng impormasyon* (S1–S4), hindi sirang form.

### 1.2 Instructor

| # | Natuklasan | Klase | File |
|---|---|---|---|
| I1 | Archived class ay **permanenteng hindi na mababalikan**. `list()` ay `.eq("archived", false)` lang, at "Unarchive" ay nasa *loob* ng class detail na hindi na mabubuksan | Dead end (critical) | [classes-remote.ts:44](../studia-mobile/src/features/instructor/data/classes-remote.ts#L44), [class-detail-screen.tsx:101-118](../studia-mobile/src/features/instructor/screens/class-detail-screen.tsx#L101) |
| I2 | "To Grade" (Home stat card **at** global Assessments tab, 2 lugar) ay quiz submissions lang ang binibilang — assignment submissions na kailangan ng grading ay invisible sa pareho | Bug (functional — "All caught up" kahit may hindi na-grade) | [use-stats.ts:12-33](../studia-mobile/src/features/instructor/hooks/use-stats.ts#L12), [assessments-screen.tsx:28-31,77-102](../studia-mobile/src/features/instructor/screens/assessments-screen.tsx#L28) |
| I3 | Tatlong entry point papunta sa parehong 2 create-form: Home Quick Actions, global Assessments tab, at class detail's "+Post" sheet | Redundancy | home-screen.tsx, assessments-screen.tsx, [class-detail-screen.tsx](../studia-mobile/src/features/instructor/screens/class-detail-screen.tsx) (Assessments tab) |
| I4 | Class detail's Assessments tab "+Post" bottom sheet (New Assignment / New Quiz / Generate Quiz with AI) ay **TAMA na** — ito na ang GClass-style single `+Create` na hinihiling. Panatilihin ang pattern na ito, i-retire lang ang mga duplicate (I3) | Patunay na gumagana na ang tamang pattern | class-detail-screen.tsx |
| I5 | Grades tab rows (per-class gradebook) ay hindi tappable — walang `onPress` | Flow gap | [grades-tab.tsx:42-54](../studia-mobile/src/features/instructor/components/class-detail/grades-tab.tsx#L42) |
| I6 | AI Quiz banner sa global Assessments tab: "Generate a quiz from a lesson" — **mali**, dahil ang totoong `ai-quiz-screen.tsx` ay topic-text lang, walang lesson/material na pinipili | Copy/implementation mismatch | [assessments-screen.tsx:45](../studia-mobile/src/features/instructor/screens/assessments-screen.tsx#L45) |
| I7 | **Manual quiz form (`quiz-form.tsx`) ang pinakamahinang form sa buong app.** Title, piniling class, at question content ay **hindi validated**. Puwedeng ma-save bilang draft nang blangko ang title, walang napiling class (`classId: null`), blangkong tanong, o MC na may blangkong option kung saan tumuturo ang `correctIndex` | **Form bug (kritikal)** | [quiz-form.tsx:106-123](../studia-mobile/src/features/instructor/components/quiz-form.tsx#L106), [question-editor.tsx](../studia-mobile/src/features/instructor/components/question-editor.tsx) |
| I8 | **AI quiz generator ay topic-text lang, walang koneksyon sa anumang lesson/material.** `generateQuiz({ topic, count, difficulty })` → walang `sourceId`/`materialId` kahit saan. Hindi rin pinipili ng instructor ang Bloom level (read-only badge lang pabalik). Mga tanong ay **tinatanggal lang, hindi ma-edit**. Walang due date/time-limit/late-policy field — dapat pang buksan sa `edit-quiz` para lagyan ng schedule | **Form + architecture gap (kritikal, direktang kaugnay ng hiling ng user)** | [ai-quiz-generator.ts:24-25](../studia-mobile/src/features/instructor/logic/ai-quiz-generator.ts#L24), [ai-quiz-screen.tsx:63-74,135](../studia-mobile/src/features/instructor/screens/ai-quiz-screen.tsx#L63) |
| I9 | `ai-quiz-screen.tsx`'s `save()` ay walang guard kung `classId === null` bago tawagan ang `createQuiz.run` | Form gap | [ai-quiz-screen.tsx:63-74](../studia-mobile/src/features/instructor/screens/ai-quiz-screen.tsx#L63) |
| I10 | `create-quiz` (manual) at `ai-quiz` ay dalawang hiwalay na screen/route na may magkaibang shape (manual ay may buong Schedule & rules; AI ay walang schedule kahit isa) | Redundancy | — |
| I11 | Dalawang hiwalay, magkatulad na grading screen: `grade-submission` (quiz) ay may "grade next" shortcut, `grade-assignment` ay **wala** | Redundancy + inconsistency | [grade-submission-screen.tsx:96-101](../studia-mobile/src/features/instructor/screens/grade-submission-screen.tsx#L96), [grade-assignment-screen.tsx](../studia-mobile/src/features/instructor/screens/grade-assignment-screen.tsx) |
| I12 | Material upload polling (`processing` state) ay bawat 2s nang walang backoff/max-attempts/timeout. Kung permanenteng stuck sa `processing` ang server, walang paraan pabalik maliban sa `failed` state | Reliability gap | [material-detail-screen.tsx:58-62](../studia-mobile/src/features/instructor/screens/material-detail-screen.tsx#L58) |

**Mahalagang kabaligtaran:** `assignment-form.tsx` (shared ng create/edit) ay **pinakamahusay na form sa
instructor side** — buong validation, dirty-tracking, confirm-discard. Ginamit itong pattern bilang reference
sa paggawa ng maayos na `quiz-form.tsx` (I7) at ng bagong AI quiz form (seksyon 5).

### 1.3 Shared/core at design consistency

| # | Natuklasan | Klase | File |
|---|---|---|---|
| C1 | AI assistant ay isang global thread kada role; `threadId` ay nasa `useRef` lang — nawawala sa bawat cold start kahit buhay pa ang thread sa server (`ai_chat_messages`) | **Direktang kaugnay sa hiling ng user ("session memory")** | [ai-assistant-screen.tsx:32,70](../studia-mobile/src/features/shared-screens/screens/ai-assistant-screen.tsx#L32) |
| C2 | AI chat error ay lumalabas bilang chat bubble, hindi `useToast`/banner gaya ng ibang screen | Inconsistency | [ai-assistant-screen.tsx:75](../studia-mobile/src/features/shared-screens/screens/ai-assistant-screen.tsx#L75) |
| C3 | `account-screen.tsx` ay gumagamit ng `` `${C.red}1A` `` alpha-hex concat — ang eksaktong anti-pattern na babala mismo ng `studia-colors.ts` (Android elevation artifact) | Token violation | [account-screen.tsx:127](../studia-mobile/src/features/shared-screens/screens/account-screen.tsx#L127) |
| C4 | `account-screen.tsx` ay nag-hardcode ng `"Poppins_700Bold"` sa halip na `FONT.bold` | Token violation | [account-screen.tsx:131](../studia-mobile/src/features/shared-screens/screens/account-screen.tsx#L131) |
| C5 | `account-password-screen.tsx` ay nag-import ng `PasswordMeter` mula sa `features/auth` — cross-feature import ng component na hindi pa na-promote sa `shared/` | Architecture debt | [account-password-screen.tsx:10](../studia-mobile/src/features/shared-screens/screens/account-password-screen.tsx#L10) |
| C6 | **Ang buong auth flow (`login`/`register`/OTP/reset) ay bukod, parallel na component system** — sariling `Field` (duplicate ng `FormField`), sariling `Dropdown`/`DropdownHost` (duplicate ng umiiral na `dropdown.tsx`/`select-field.tsx`), sariling `Banner` (duplicate ng `Toast`/`useToast`), 12+ hardcoded `"Poppins_*"` string, hardcoded `rgba(...)` na duplicate ng `OVERLAY.*` tokens, hardcoded `"#FFF6EC"` na walang token. Hindi rin dumadaan sa `useMutation` — sariling `guard()` ang gamit | **Pinakamalaking inconsistency sa app** | [auth-parts.tsx](../studia-mobile/src/features/auth/components/auth-parts.tsx), [auth-screen.tsx](../studia-mobile/src/features/auth/screens/auth-screen.tsx) |
| C7 | `report-error.ts` ay sinadyang no-op sa production — nakumpirma sa lumang `audit.md` §4.1, muling na-verify dito | Known (not new) | [report-error.ts:14-22](../studia-mobile/src/core/logic/report-error.ts#L14) |
| C8 | `use-draft-autosave.ts` ay tahimik na nabibigo (save/restore) — kaugnay sa anumang multi-step form na gumagamit nito (quiz editor, assignment form) | Known (not new) | [use-draft-autosave.ts:17-44](../studia-mobile/src/shared/hooks/use-draft-autosave.ts#L17) |
| C9 | Ang `shared/components/ui` kit (44 files) ay **mahusay disenyo at token-compliant** — ang problema ay *adoption*, hindi ang kit mismo. Auth (C6) at parts of Account (C3–C5) lang ang lumalabas sa pattern | Positibong natuklasan | — |

---

## 2. Mga dapat pagsamahin (final — binago laban sa totoong code)

| Ngayon | Gawing | Batayan |
|---|---|---|
| Home "Today's tasks" + "Upcoming deadlines" + To-do tab + bawat class's Tasks tab | Isang **To-do** sistema (tab), may 3 filter (**Assigned · Missing · Done** — tama ang mungkahi ng `UI-FLOW-AUDIT.md`), isang shared status-label/tone helper. Home ay nagpapakita lang ng top-3 na due-soonest item mula sa **parehong** query, bawat isa ay direktang naka-link sa specific na item (ayusin S7) | S1–S4, S7 |
| Home Quick Actions (My Courses/To-do/Planner/AI Assistant) | Tanggalin — redundant na sa tab bar (S6) | S6 |
| Home "Create Quiz"/"AI Quiz"/"Analytics" Quick Actions + global Assessments tab's 2 create button | Tanggalin pareho; panatilihin lang ang class detail's "+Post" sheet (I4) bilang **tanging** paraan para gumawa ng assignment/quiz | I3, I4 |
| `create-quiz` (manual) + `ai-quiz` | Isang quiz form na may "Generate with AI" na opsyon sa loob (gaya ng iminungkahi noon), **pero** kasama na ngayon: schedule fields sa AI path, editable AI questions, at ang bagong lesson-source picker (seksyon 5) | I8, I10 |
| `grade-submission` (quiz) + `grade-assignment` | Isang grading screen na may "grade next student" sa pareho (hiramin ang pattern ng `grade-submission`) | I11 |
| Account: "Personal Information" + "Change Photo" | Tap sa avatar para palitan ang photo (gaya ng dati) | (kumpirmado, panatilihin) |
| Account: Privacy Policy + About | Isang **About** | (kumpirmado, panatilihin) |
| AI assistant (isang flat thread) | Tingnan seksyon 5 — magiging class-scoped na may history list | C1 |

**Hindi pagsamahin (binawi):** Ang `UI-FLOW-AUDIT.md`'s mungkahi na tanggalin ang student Grades tab ay
**hindi** inirerekomenda ng dokumentong ito — nandon pa ang tab, gumagana ito, at walang bagong dahilan na
natuklasan para tanggalin. Panatilihin maliban kung may hiwalay na desisyon ang user.

---

## 3. Mga dapat tanggalin / i-retire

| Tanggalin | Dahilan |
|---|---|
| Home quick actions (buong row) | S6, I3 |
| Global Assessments tab's hiwalay na "Post" buttons (panatilihin lang ang listahan + "To Grade" sub-tab, pagkatapos i-ayos ang I2) | I3 |
| `grade-assignment-screen.tsx` bilang hiwalay na code path (i-merge ang logic papunta sa pinag-isang grading screen) | I11 |
| Auth's `Field`/`Dropdown`/`DropdownHost`/`Banner` (auth-parts.tsx) | C6 — palitan ng shared `FormField`/`SelectField`/`Dropdown`/`Toast` |

---

## 4. Ayusin ang form logic — partikular na listahan

Ayon sa hiling ng user na "fix form logic", ito ang **talagang** sirang forms (hindi lahat, tingnan 1.1/1.2
para sa mga maayos na pattern na dapat gayahin):

1. **`quiz-form.tsx` (I7)** — idagdag ang: required title (may `maxLength`), required class selection bago
   makapag-save kahit draft, required question text + required non-empty options bago mag-publish (gamitin
   ang parehong `validateAll` pattern ng `assignment-form.tsx`). I-block ang publish kung may MC question na
   ang `correctIndex` ay tumuturo sa blangkong option.
2. **`ai-quiz-screen.tsx` (I8, I9)** — tingnan seksyon 5 para sa buong redesign; minimum fix kung hiwalay:
   idagdag ang `classId` required-check bago `save()`, at idagdag ang schedule fields (due date, time limit,
   allow-late) gamit ang parehong component na ginamit ng manual quiz form.
3. **Planner `AddPlanSheet` title (S5)** — idagdag ang `maxLength` (parehong cap gaya ng ibang title field,
   hal. 100 characters).
4. **Material upload polling (I12)** — idagdag ang max-attempts (hal. 30 tries / ~1 minuto) bago palitan ang
   UI ng "Hindi pa handa, subukan mamaya" na may manual retry button, sa halip na walang-hanggang pag-poll.
5. **Auth forms (C6)** — hindi "sira" ang validation logic (gumagana ang `validateAll`/`auth-validation.ts`),
   pero dapat ilipat papunta sa shared `FormField`/`useMutation` para sa consistency at para awtomatikong
   magkaroon ng parehong loading-lock/error pattern ng ibang form sa app.

---

## 5. AI redesign — class-scoped context + persistent conversation history

Ito ang pangunahing bagong feature na hiniling: *"ai should be connected to each class including the lessons
inside it"*, *"instructor can use the ai to create quiz"* (dati pa, pero hindi lesson-grounded), at
*"dapat nakakatanda ng session yung ai"* (visible history, hindi lang single forgotten thread).

### 5.1 Batayan mula sa totoong database/API (verified)

Mayroon nang magandang pundasyon:

- `materials` → `material_summaries` (tldr/bullets/mindmap) → `material_objectives` → `material_transcript_lines`
  ay **kumpleto na** at ginagamit na ng `summarize.ts` endpoint, kasama ang multi-format source loader
  (transcript → YouTube via Gemini native video understanding → PDF inline → docx/pptx text extraction).
  Ito ang pinakamaayos na AI endpoint ngayon at ang dapat gayahin.
- Ang chat endpoint ay **may partial class-awareness na**: `classContext()` sa `studia-api/src/ai/chat.ts`
  ay nagbibigay na ng mga pangalan ng klase ng user (hal. "Their classes: IT 101...") — pero **hindi** ito
  nagbabasa ng materyal, transcript, o gawain sa loob ng bawat klase.
- Rate limits (chat 40/oras, quiz 12/oras, summary 20/oras, regenerate 3/lesson) ay **tunay at
  race-safe** — ginagamit ang reserve-before-call na pattern sa Postgres (advisory lock). Panatilihin ang
  parehong pattern para sa bagong AI calls.
- RLS sa `ai_chat_messages`/`ai_requests`: mahigpit na `user_id = auth.uid()` lang, walang admin/cross-user
  na access, sinadyang pinahigpit noong migration 008. **Mahalaga:** kung mananatiling pribado ang bawat
  thread sa may-ari nito (student/instructor's own thread, lang tinag ng class), **hindi** kailangang baguhin
  ang RLS — kakailanganin lang ng bagong `class_id` column. Kung gusto ng isang **shared class-wide**
  AI thread (lahat ng estudyante ng isang klase ay may parehong AI conversation), iba na ito at
  kakailanganin ng bagong RLS policy — **hindi inirerekomenda ngayon**, mas malaki ang saklaw at wala namang
  hiling na ganito mula sa user.

### 5.2 Target na disenyo

**(a) Class-scoped AI chat**

- Idagdag ang isang class picker/chip sa itaas ng `ai-assistant-screen.tsx` (opsyonal — "General" bilang
  default, o pumili ng isang klase).
- Kapag may napiling klase, ang request papunta sa `/api/ai/chat` ay may dagdag na `classId`. Bagong
  context-builder sa server (katabi ng umiiral na `classContext()`): kunin ang `materials` ng klase na
  `processing = 'ready'`, i-join ang `material_summaries` (TL;DR/bullets/objectives — **hindi** ang buong
  `material_transcript_lines`, para hindi lumabis sa context window), at ang mga susunod na deadline
  (`tasks`/planner rows na may `class_id = X`).
- Walang mabibagong RLS — ang query ay kailangan pa ring dumaan sa parehong ownership/enrollment check na
  gamit na ng `summarize.ts` (`:41-59`).

**(b) Lesson-grounded AI Quiz Generator**

- Idagdag sa `ai-quiz-screen.tsx` ang isang material/lesson picker (scoped sa napiling klase), opsyonal
  pero inirerekomenda — may fallback sa free-text topic kung walang pinili (backward compatible sa
  kasalukuyang behavior).
- Palawakin ang request body ng `/api/ai/quiz` (`studia-api/src/ai/quiz.ts`) ng `materialId?: string` katabi
  ng `topic`. Kapag may `materialId`, gamitin ang parehong `loadSource()` logic na nasa `summarize.ts`
  (`:156-218`) para kunin ang transcript/summary bilang batayan ng prompt, sa halip na isang linyang topic.
- Idagdag ang schedule fields (due date, time limit, allow-late) sa AI path, gamit ang parehong
  `date-time-field`/schedule component ng manual quiz form — tanggalin ang kailangan pang pumunta sa
  `edit-quiz` pagkatapos lang para lagyan ng schedule (I8, I10).
- Gawing editable ang bawat generated question bago i-save (hindi lang "Remove"), gamit ang parehong
  `question-editor.tsx` na ginagamit ng manual form.
- I-update ang banner copy sa Assessments tab (I6) para tumugma sa totoong behavior pagkatapos ma-implement.

**(c) Persistent, resumable conversation history**

Kasalukuyang estado: `ai_chat_messages.thread_id` ay bare text column, walang title/class_id/metadata, at
walang `ai_threads` table — kaya walang paraan ngayon na ilista ang mga nakaraang thread na may pangalan.

Kailangan:

1. **Bagong table** `ai_threads` (migration): `id`, `user_id`, `class_id` (nullable — null = "General"),
   `title` (auto-generated mula sa unang mensahe, o "New conversation"), `last_message_at`, `created_at`.
   RLS: `user_id = auth.uid()` lang — pareho sa umiiral na pattern, walang bagong exposure.
2. Palitan ang client-generated/ad-hoc `threadId` ng isang tunay na row sa `ai_threads`: kapag nagsimula ng
   bagong conversation, `insert` muna sa `ai_threads`, gamitin ang resultang `id` bilang `thread_id` sa
   `ai_chat_messages` (parehong column, walang breaking change doon).
3. **Client:** i-store ang kasalukuyang `threadId` sa secure/local storage (hindi lang `useRef`) para
   mabuhay ito sa cold start — ito ang minimum fix (C1) kung nais lang ipagpaliban ang buong history UI.
4. **Bagong history screen**: listahan ng `ai_threads` ng user (pinakabago muna, `last_message_at` desc),
   opsyonal na pinagkahiwalay by class (grupo: "General" + bawat klase), tap para buksan/ituloy ang dating
   thread, swipe/long-press para i-rename o i-delete. Ito ang "visible conversation history" na pinili ng
   user — bagong screen + repository methods (`AiThreadRepository.list()`, `.rename()`, `.delete()`),
   hindi lang pag-persist ng isang ID.
5. Panatilihin ang kasalukuyang disenyo na **hindi** nagpapadala ng history pabalik sa server mula sa
   client (`history` field sa request ay dinedeliberate na balewalain) — ito ang tamang proteksyon laban sa
   pekeng AI statement na idinagdag ng client sa thread, panatilihin ito.

### 5.3 Buod ng pagbabago kada layer

| Layer | Pagbabago |
|---|---|
| `supabase/migrations/` | Bagong `ai_threads` table + RLS (user-owned, pareho ang pattern); bagong nullable `class_id` sa parehong `ai_threads`. Walang pagbabago sa `ai_chat_messages`/`ai_requests` schema mismo. |
| `studia-api/src/ai/chat.ts` | Tanggapin ang `classId` (opsyonal); bagong class-context builder (materials+summaries+deadlines); gamitin ang `ai_threads` sa halip na bare `thread_id` text para sa listing/pag-title. |
| `studia-api/src/ai/quiz.ts` | Tanggapin ang `materialId` (opsyonal); gamitin ang `loadSource()` mula sa `summarize.ts` kapag may `materialId`. |
| `studia-mobile` AI tab (`ai-assistant-screen.tsx`) | Class picker, persisted threadId, bagong history screen + navigation papunta rito. |
| `studia-mobile` AI Quiz (`ai-quiz-screen.tsx`) | Material/lesson picker, schedule fields, editable questions, `classId` required-guard (I9). |
| `docs/api-contract.md` | I-update ang AI section (seksyon 0 sa itaas) para tumugma sa totoong `{threadId, message}`/`{topic, materialId?, count, difficulty}` shape pagkatapos ma-implement. |

---

## 6. Design consistency — panatilihin ang umiiral na visual identity

Walang bagong palette/component system na kailangan — ang `shared/components/ui` kit (44 files) ay maayos
na disenyo (C9). Ang trabaho dito ay **adoption**, hindi redesign:

1. Ilipat ang auth flow (C6) papunta sa shared `FormField`/`SelectField`/`Dropdown`/`Toast`/`useMutation`.
2. Ayusin ang 5 token violation sa C3–C5 (alpha-hex concat, hardcoded Poppins strings, hardcoded hex/rgba).
3. Gawing consistent ang AI chat error display (C2) — `useToast` sa halip na chat bubble, gaya ng ibang
   screen.
4. Promote ang `PasswordMeter` (C5) papunta sa `shared/components/ui` kung gagamitin ito sa labas ng auth.
5. Opsyonal na pino (hindi required): i-review ang spacing/card density sa Home at Assessments pagkatapos
   matanggal ang mga redundant na seksyon (2–3), dahil magbabago ang laman ng mga screen na ito.

---

## 7. Panukalang pagkasunod-sunod ng trabaho

| Phase | Laman |
|---|---|
| 1 | **Mga dead end/bug na hindi kailangan ng bagong disenyo:** I1 (archived classes), I2 (To Grade excludes assignments), S7 (Upcoming deadlines routing), I5 (Grades tab rows tappable) |
| 2 | **Fix form logic:** quiz-form validation (I7), ai-quiz classId guard (I9), Planner title maxLength (S5), material upload polling (I12) |
| 3 | **Merge/retire (seksyon 2–3):** To-do consolidation (S1–S4), Quick Actions cleanup (S6, I3), grading screen merge (I11) |
| 4 | **AI redesign (seksyon 5):** `ai_threads` migration → chat class-context + persisted threadId → history screen → AI quiz lesson-source + schedule fields |
| 5 | **Design consistency (seksyon 6):** auth → shared kit migration, token-violation cleanup |

---

## 8. Hindi pa nasuri nang detalyado (susunod na pass)

- `notifications-screen.tsx` — kumpirmado lang ang lumang `UI-FLOW-AUDIT.md` claim (bottom sheet lang,
  walang deep link) na hindi pa muling na-verify sa pass na ito.
- File viewer (PDF/slides) implementation detail.
- Account sub-pages na "not built yet" (Notification Settings, Appearance, Language, Privacy & Security,
  Help) — wala pang code na susuriin.
- Full-app grep para sa `rgba(` at `"Poppins_` literals sa labas ng auth/account — ang C3–C6 ay base lang sa
  shared-screens/auth/core scope, posibleng may karagdagan sa ibang screen.
