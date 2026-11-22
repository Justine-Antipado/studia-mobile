# UI-FIXED-AND-LOGIC — Audit Report (studia-mobile)

> **Audit only. Walang code na binago.** Ang file na ito lang ang idinagdag.
> Petsa: 2026-11-22 · Branch: `claude/auth-ui-improvements-9n1nu2` · Saklaw: `studia-mobile/src` (student + instructor), kasama ang `supabase/migrations` at `docs/api-contract.md` kung saan kailangan.

Paano basahin: bawat item ay may **Ano ang nakita** → **Root cause (file)** → **Dapat gawin**. Sa dulo ay may priority order at listahan ng mga bagay na kailangan ng desisyon mo bago i-code.

---

## 0. Buod (TL;DR)

| # | Request mo | Status sa code ngayon | Laki ng gawa |
|---|---|---|---|
| 1 | Placeholder `you@gmail.com` | 1 linya lang (`auth-screen.tsx:608`) | XS |
| 2 | Notification detail bago mag mark-as-read | Pag-pindot = agad mark-read, walang detail | M |
| 3 | Account tab: clickable cards + subpages + OTP-protected edit | Puro `Alert`/walang-gawa (`() => {}`); walang route | L |
| 4 | Instructor makapag-comment sa announcement | **UI at repository lang ang kulang** — papayag na ang DB (RLS) | S |
| 5 | Assignment: custom due date, editable, late dropdown | Presets lang; may `update()` na pero **walang edit screen** | M |
| 6 | Bot chat input natatakpan ng keyboard (Android) | Root cause: Android edge-to-edge, walang gumagana na keyboard avoidance | M |
| 7 | Header chips (Stream/Materials/…) margin at overflow | Root cause: negatibong `marginHorizontal` sa `SegmentedTabs` | S |
| 8 | Tanggalin ang "Good day / Welcome back + pangalan" at lagyan ng page title na kapareho ng tab | Home lang may greeting; Courses/Classes/Assess/Alerts/Account iba-iba ang title | S |
| 9 | To-do: sub-nav at sort arrow nag-aagawan | Root cause: parehong negatibong margin → nag-o-overlap; gawing Filter sheet | S |
| 10 | Study Planner: "Regenerate schedule" parang walang ginagawa | **Tatlong magkakahiwalay na bug** (timezone, week window, deterministic output) | M |
| 11 | Quiz/Assignment: due, close time, late policy, editable, customizable # of questions | Wala sa instructor quiz; student quiz may `dueAt` pero walang late rule | L |
| 12 | Instructor: makita ang napasa/hindi pa + grade ng student per assignment | Wala — assignment detail ay puro instructions + delete | L |
| 13 | Video = link lang (+ "Watch in YouTube"), AI summary pa rin; upload max 50 MB | Student player nagpe-play ng **hardcoded sample video**; client cap 500 MB, DB cap 40 MB | M |
| 14 | Gradebook filter (lahat o specific assignment, per class) | Class chip lang; quizzes lang ang nasa gradebook (walang assignments) | M |
| 15 | Quiz creation: due, late (editable pati questions) | Wala; walang edit-quiz | L |

May **8 cross-cutting logic findings** (seksyon 3) na mas importante pa sa UI polish — lalo na ang *student at instructor ay may magkahiwalay na mock data stores*, kaya ang ginawa ng instructor ay hindi nakikita ng student.

---

## 1. Mga hiniling mo — detalyadong audit

### 1.1 Auth email placeholder → `you@gmail.com`
- **File:** `features/auth/screens/auth-screen.tsx:608` → `placeholder="you@school.edu.ph"`.
- **Dapat gawin:** palitan ng `you@gmail.com`.
- **Kaugnay na logic (huwag kalimutan):**
  - `supabase/migrations/…010_gmail_only.sql` ay nag-eenforce na ng **Gmail-only para sa NEW accounts** (server hook).
  - `features/auth/logic/auth-validation.ts` (`EMAIL_RE`, line ~89) ay generic lang. Para hindi mag-bounce ang user sa server error pagkatapos ng OTP step, lagyan ng **client-side hint** sa *signup/forgot* mode lang: `@gmail.com`. **Huwag** i-restrict ang login — ang seeded demo users (`@omsc.edu.ph` / `@omsu.edu.ph`) ay kailangan pang makapag-login.
  - `docs/api-contract.md` (line ~317) ay nagsasabi pa ring `@omsu.edu.ph` ang domain rule — **outdated**; i-update.
  - Ang mga hardcoded demo user sa `shared-screens/screens/account-screen.tsx` (`switchDemoRole`) ay `@omsu.edu.ph` din — okay lang (demo-only) pero dapat naka-`__DEV__` gate (tingnan 3.7).

### 1.2 Notifications: detail form bago mag-mark-as-read (student + instructor)
- **Ngayon:** `features/shared-screens/screens/notifications-screen.tsx` → `onPress={() => onRowPress(n.id)}` = tawag agad sa `markRead`. Walang detail. Ang `NotificationItem` (`types/shared-screens.ts`) ay may `title, meta, time, tag` lang — walang `body`, walang `target` (saan ito papunta).
- **Dapat gawin:**
  1. Palawakin ang type: `body: string`, `createdAt: ISO`, at optional `target?: { route, params }` (hal. quiz, announcement, submission).
  2. Pag-pindot → buksan ang **detail** (inirerekomenda: `BottomSheet` na existing component, o bagong route `notification-detail` sa `SUBPAGE_ROUTES` ng parehong role layout). Ipakita: tag/icon, title, buong body, oras, at "Open [quiz/announcement]" button kung may `target`.
  3. **Mark-as-read ay mangyari pagkatapos makita** (sa pag-open ng detail pagka-render, o sa "Mark as read" button sa detail — pumili ka; default na iminumungkahi: automatic on open of detail, hindi sa list tap). Gamitin ang existing `useMarkNotificationRead` (optimistic na).
  4. Ang trailing sa row: kapag *read* na, ngayon ay nagpapakita ng `Badge` ng tag; OK pero redundant sa `eyebrow` (parehong tag ang lumalabas dalawang beses sa read rows). Linisin.
- **Logic bugs na natagpuan dito:**
  - `app/student/(tabs)/_layout.tsx:18` at `app/instructor/(tabs)/_layout.tsx:19` → `badge: 2` ay **hardcoded**. Hindi sumusunod sa totoong unread count; mananatiling "2" kahit mark-all-read na. Dapat galing sa `useNotifications(role)` unread count.
  - `NotificationsScreen` ay nasa `shared-screens`, pero may dalawang wrapper pa (`app/*/(tabs)/notifications.tsx` + `features/{student,instructor}/screens/notifications-screen.tsx`) — tingnan 3.6 (duplicate/dead).
  - Mock `markRead` ay nag-me-mutate ng `FEEDS` bago mag-latency; OK. Pero mock feed ay **isang beses lang** na-seed at hindi nagre-react sa totoong events (hal. nag-post ng announcement → walang notif). Para sa remote, galing na sa `notifications` table (RLS: owner lang ang pwedeng mag-update ng read).

### 1.3 Account tab: clickable cards + subpages (student + instructor)
- **Ngayon:** `features/shared-screens/screens/account-screen.tsx`
  - Personal Information → `Alert.alert(...)` (line 77), Password → `Alert.alert(...)` (83).
  - Privacy Policy, About Application, Change Profile → `onPress={() => {}}` (89, 95, 101) — **patay na buttons**.
  - Ang header comment mismo ay nagsasabing "Sub-pages … are a later phase".
- **Dapat gawin — 5 subpages** (lagay sa `SUBPAGE_ROUTES` ng `app/student/_layout.tsx` at `app/instructor/_layout.tsx`; route files = one-line re-export lang ayon sa CLAUDE.md):

  | Subpage | Laman | Notes |
  |---|---|---|
  | `account-personal` | Name, email (read-only), mobile, course/year/section (student) o department (instructor) | **Edit mode ay require ng OTP**: Save → mag-send ng OTP sa email → verify → saka lang i-apply. Gamitin ang existing `auth-api`/`resendOtp`/`verifyOtp` (purpose `profile_update` — bagong purpose; idagdag sa `AuthTypes` at sa `api-contract.md`). |
  | `account-password` | Current → OTP → new password + confirm | Reuse ang 5 password rules at checklist sa `auth-validation.ts`; huwag mag-duplicate. |
  | `account-privacy` | Privacy Policy text (scrollable), "Clear cache" (nasa UI-BRIEF §Account > Privacy & Security) | Static content, ilagay sa `shared-screens/data` o `docs`; may version/date. |
  | `account-about` | App name, version (galing sa `expo-constants`, **huwag i-hardcode** ang "v1.0.0" gaya ngayon), campus, credits, licenses | |
  | `account-photo` ("Change Profile") | Camera / Gallery / Remove | Kailangan ng `expo-image-picker` (nasa UI-BRIEF pero **wala** sa `package.json`) → `npx expo install expo-image-picker`; native module = dev build. Avatar ay nasa Supabase Storage; limitahan ang laki (≤2 MB) at i-compress. |
- **Responsiveness:** gamitin ang parehong pattern ng ibang subpages: `Screen` + `PageTitle onBack={useSafeBack(...)}` + `useRoleUser(role)` — para pantay ang header, safe-area bottom inset, offline banner at keyboard handling. Huwag gumawa ng custom na layout.
- **Mga isyu na dapat ayusin kasabay:**
  - **Stale profile:** `session-store.ts` ay `setUser`/`useUser`; kapag na-edit ang profile kailangang tumawag ng `setUser` para mag-update agad ang `AppHeader` (name/tag) at Account card.
  - **Role-specific fields:** `UserProfile` ay may `course/year/section` (student) at `department` (instructor); ang form ay kailangang role-aware (iisang component, `role` prop — ito na ang convention).
  - **"Switch to Student/Instructor View"** (account-screen) ay demo-only na nagpapalit ng user sa mock identity. Sa **remote mode** ito ay maling gawi (nagpapakita ng ibang role nang walang auth). Dapat nasa `__DEV__` lang (tingnan 3.7).
  - Log out → `router.replace({pathname:"/auth"...})` bago matapos ang `signOut()` purge (`void signOut()`); OK sa mock, pero sa remote dapat `await` o hindi bababa sa siguraduhing walang race sa cache purge at token revoke.

### 1.4 Announcement comments — dapat parehong student at instructor
- **Root cause:** `features/instructor/screens/announcement-detail-screen.tsx` ay may comment *list + moderation delete* lang; **walang input/Post button** (ang student version ay mayroon). Ang `InstructorAnnouncementRepository` (`data/announcements-repository.ts`) ay walang `addComment` method, at walang `useAddComment` sa `hooks/use-announcements.ts`.
- **Hindi na kailangan ng DB change:** `supabase/migrations/…002_classes.sql` → `cmt_insert` policy ay pumapayag na sa `is_class_member OR is_class_owner`. Ibig sabihin DB-wise okay na; UI + repo + `docs/api-contract.md` (line ~174, instructor announcements) lang ang kulang (`POST /instructor/classes/{classId}/announcements/{id}/comments`).
- **Dapat gawin:** (a) idagdag ang `addComment` sa instructor repo + hook (kopyahin ang student's optimistic/validation: `validateCommentText`, max 500); (b) ilipat ang "comment composer" (FormField + Post button + validation + toast) sa **iisang shared component** (`shared/components/ui/comment-composer.tsx`) at gamitin sa dalawang screen — ito ang tamang dedupe dahil magkapareho na ang `CommentRow`; (c) sa mock, `author: "You"` ay hardcoded sa student repo at `authorIsMe` — dapat galing sa session user (para lumabas ang tamang pangalan at "Instructor" badge); (d) lagyan ng "Instructor" label sa comment ng instructor para makilala ng students.
- **Kaugnay na bug:** Student `CommentRow` ay `canDelete="own"` pero ang student `deleteComment` ay walang toast sa failure (instructor version ay mayroon). Pantayin.

### 1.5 Assignment due date — custom date, editable, late dropdown, attachments hindi mawawala
- **Ngayon:** `create-assignment-screen.tsx` → `DUE_PRESETS` (Tomorrow / In 3 days / Next week) at `dueHours` state; `dueAt = Date.now() + dueHours*3_600_000` — kaya ang due ay *relative sa sandaling i-submit*, hindi sa binuo mong choice (kung nag-iisip ka ng 10 minuto, magbabago ang oras).
- **Late submissions:** dalawang `Chip` ("Allowed (tagged Late)" / "Not allowed (stays a draft)").
- **Edit:** `InstructorAssignmentRepository.update()` at `useUpdateAssignment()` ay **umiiral pero walang gumagamit** (dead code — natukoy ng scan). Walang "Edit" button sa `assignment-detail-screen.tsx`.
- **Dapat gawin:**
  1. **Date/time picker:** walang date-picker lib sa project. Official Expo option: `@react-native-community/datetimepicker` (`npx expo install …`; native → dev build). Alternatibo na walang native dependency: custom "Date" + "Time" input na may validation (YYYY-MM-DD / HH:mm) — pero mas error-prone (ito ang ginawa sa Planner at may mga isyu, tingnan 1.10). Rekomendasyon: datetimepicker.
  2. State: `dueAt: Date` (default = bukas 11:59 PM), display "Nov 18, 2026 · 11:59 PM". Panatilihin ang **quick presets** bilang shortcut na nagse-set ng `dueAt` (hindi na hiwalay na `dueHours`). Validation: hindi pwedeng nasa nakaraan sa *create*; sa *edit*, payagan ang pagbabago kahit na lumipas na (para ma-extend ang deadline).
  3. **Late policy bilang dropdown** (hindi chips): `Allowed — tagged Late` · `Not allowed — stays a draft`. Gamitin ang BottomSheet-based select (gawin bilang reusable `SelectField` sa `shared/components/ui`; ang auth screen ay may kaparehong "Select course/department" kaya may existing pattern na pwedeng kunin).
  4. **Optional: "Closes at"** (hanggang kailan pa tatanggap ng late). Ito ang "hanggang anong oras o araw lang open" na sinabi mo. Kailangan ng migration: `assignments.closes_at timestamptz null` + check (`closes_at >= due_at`); at sa student `attach()` rule: `now > closes_at` → reject (hindi lang draft).
  5. **Edit screen:** reuse ang `create-assignment-screen` bilang *form component* (`AssignmentForm`) na tumatanggap ng `initial` at `mode: "create" | "edit"`. Idagdag ang "Edit" action sa instructor `assignment-detail`. Ang file ng screen ay nasa 142 lines; ang bagong form logic ay malalagpasan ang 250-line limit ng UI-BRIEF kaya hatiin (`components/assignment-form.tsx` + `logic/assignment-schedule.ts`).
  6. **Attachments ay hindi dapat mawala sa edit:** `update()` ay nagre-replace ng `attachments: draft.attachments`. Kaya ang edit form ay **dapat mag-preload ng existing attachments** at ipadala ang buong listahan; kung hindi, mabubura ang lahat. Dapat ding may remove-per-file at add-more. (Sa remote, ang remove ay dapat mag-delete din ng file sa Storage — huwag mag-iwan ng orphan.)
  7. **Edit pagkatapos mag-post at may submissions na:** pumayag, pero (a) kapag *ibinaba* ang `points` sa ibaba ng na-grade nang score → i-block o i-warn; (b) kapag *inilipat* ang due → muling suriin ang status ng mga submission ("late" → "submitted" kung inilipat paabante). Ito ay server-side rule at dapat nasa `api-contract.md`.
  8. **Time zone:** i-store sa UTC ISO (ginagawa na), i-display sa `Asia/Manila` (`en-PH` locale lang ang naka-set; hindi naka-lock ang time zone — tingnan 3.4).
- **Student side:** `dueLabel` ay maayos na; pero ang `assignment-detail-screen.tsx` ay walang "closes" info o "late allowed until…" text.

### 1.6 AI chat input natatakpan ng keyboard (Android; ok daw sa iPhone at ibang Android)
Ito ang nakikita sa screenshot #2 (input at send button nasa ilalim ng keyboard) at pati sa BottomSheet ng "Add exam date" (screenshot #5: ang sheet ay natatakpan din).
- **Root cause (global, hindi lang sa chat):**
  1. `app.json` ay walang `android.softwareKeyboardLayoutMode` at walang edge-to-edge config. Sa **RN 0.88 / Expo SDK 58**, ang Android ay naka-**edge-to-edge** (forced sa Android 15+/targetSdk 35+). Sa mode na ito, ang `adjustResize` ay hindi na nagre-resize ng window sa maraming device (Oppo/Realme/Xiaomi/ColorOS skins lalo) — kaya ang keyboard ay *nasa ibabaw* ng content imbes na magtulak.
  2. `shared/components/ui/screen.tsx` → `KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}` — **walang gawin sa Android**.
  3. `bottom-sheet.tsx` → pareho (`undefined` sa Android) at ang `Modal` ay hiwalay na window kaya hindi apektado ng root layout.
  4. `ai-assistant-screen.tsx` ay may **custom manual workaround** (`Keyboard.addListener` + `measureInWindow` + `kbPad`) na umaasa sa `e.endCoordinates.screenY`. Sa edge-to-edge/device na ito, ang `screenY` at `measureInWindow` ay hindi pareho ng coordinate space (status bar/nav bar offset), kaya `kbPad` ay lumalabas na 0 o mali → hindi umaangat ang composer. Ang `studia-tab-bar.tsx` ay nagtatago ng tab bar kapag bukas ang keyboard (tama), pero ito rin ay umaasa sa `keyboardDidShow` (huli sa Android).
  5. Dagdag: ang `KeyboardAvoidingView` ay *nasa loob ng* `Screen` at ang AI screen ay gumagamit ng `scroll={false}` + `fixed` padding na may `safeBottom` — kapag may `kbPad` AT `safeBottom`, doble ang padding sa mga device na gumagana ang resize.
- **Dapat gawin (pumili ng isa, huwag paghaluin):**
  - **A (inirerekomenda):** `react-native-keyboard-controller` (`npx expo install react-native-keyboard-controller`; native → dev build; may Expo config plugin). Palitan ang `KeyboardAvoidingView` sa `Screen` at `BottomSheet` ng `KeyboardAvoidingView` ng library na iyon (`behavior="padding"`) at **alisin ang buong manual `kbPad` logic** sa AI screen. Ito ang pinaka-reliable sa lahat ng Android skin; ginagamit din ito para sa `KeyboardStickyView` ng chat composer.
  - **B (walang bagong native dependency):** `useAnimatedKeyboard` o `Keyboard` events na `height = e.endCoordinates.height` (hindi `screenY`) bilang bottom padding, sa **iisang** shared hook `useKeyboardInset()` na ginagamit ng `Screen` at `BottomSheet`; i-set din `android.softwareKeyboardLayoutMode: "pan"` sa `app.json` para consistent. Mas marupok sa ibang skin.
  - Kahit alin: **siguraduhing ang kaparehong fix ay sumasaklaw sa**: AI chat (student + instructor), Add exam sheet, Post announcement, Create assignment/quiz forms, Auth screen (ang `auth-screen.tsx` ay may sarili ring `KeyboardAvoidingView` na iba rin ang config), grade-submission (feedback field).
  - Sa composer: `blurOnSubmit={false}` + `returnKeyType="send"` + `multiline` ay conflict (sa multiline, ang Enter ay newline sa Android at hindi tumatawag ng `onSubmitEditing`). Alisin ang `onSubmitEditing`/`returnKeyType` at umasa sa Send button, o gumamit ng `submitBehavior`.
  - Subukan sa: Oppo/Realme (ColorOS), Samsung (One UI), Pixel (stock), at isang iPhone — dahil ang bug na ito ay *device-skin dependent*.
- **Kaugnay na UX:** Kapag bukas ang keyboard, ang mga suggestion chips ay kumakain ng espasyo (screenshot #2: chips lang ang natitira). I-hide ang chips habang may focus ang input at kapag may mensahe na.
- **Maliit pang obserbasyon:** ang mga "gear" na bilog sa screenshot (floating) ay dev-menu/Expo dev client button (`expo-dev-client`); hindi bahagi ng UI ng app at hindi lalabas sa production build.

### 1.7 Header tabs (Stream / Materials / Assessments / People …) — margin at overflow
- **Root cause (`shared/components/ui/segmented-tabs.tsx`, lines 57–58):** `style={[s.scroll, { marginHorizontal: -inset }]}` + `contentContainerStyle paddingHorizontal: inset` (default `inset = 18`). Ito ay intensyonal na "bleed to edge" na trick, pero:
  - Sa kaliwa may 18px padding (kaya may margin ang "Stream"), samantalang sa kanan ang huling chip ay **na-clip sa gilid ng screen** (nakikita sa screenshot #3: "Peopl"). Dahil ito ay horizontal scroll na hindi napapansin ng user, mukhang sira ang kanang gilid.
  - Dahil `-inset` ay hardcoded sa 18 at hindi alam ng component ang tunay na padding ng parent (Screen `content` = 18, `fixed` = 18, ngunit sa tablet ang `inner` ay may `maxWidth` at naka-center), mali ang bleed sa wide screens (hindi aabot sa screen edge, kaya may kakaibang clip sa loob ng container).
  - Kapag ginamit sa loob ng isang row na may kapatid (To-do), ang negatibong margin ay **pumapasok sa katabing element** — tingnan 1.9.
- **Dapat gawin:** (pumili ng isa)
  1. **Iwasan ang bleed:** alisin ang negatibong margin; hayaang ang strip ay nasa loob ng content width (may 18px margin sa dalawang dulo), `overflow: "hidden"`, at lagyan ng *fade/gradient* o bahagyang "peek" sa kanang gilid para malaman na scrollable (`expo-linear-gradient` ay nasa dependencies na).
  2. O kung gusto mong bleed pa rin: panatilihin pero siguruhing may **`paddingRight` = inset sa dulo** (nasa contentContainer na) at **huwag i-clip** — ang problema ngayon ay ang clip na nakikita ng user ay *normal na scrolling behavior* na hindi halata. Kaya (1) ang mas malinaw.
  3. `SegmentedTabs` ay dapat tumanggap ng `style`/`inset` mula sa parent na `Screen` (context) imbes na default na 18 magic number (CLAUDE.md: walang magic number sa screen; gamitin ang `SPACE`/constants).
- **"Overflow hidden sa lahat ng may ganoon":** hanapin at pantayin ang lahat ng horizontal strips:
  - `shared/components/ui/segmented-tabs.tsx` (Class detail ×2, Todo, Planner days, Notifications, Assessments)
  - `shared-screens/components/ai-chat-composer.tsx` (suggestion chips — screenshot #1/#2: "Class summ" na putol; walang right inset/fade; `sugRow paddingRight` lang, walang left)
  - Mga `flexWrap` chip rows (gradebook, grading, create quiz) ay hindi scroll — OK, pero walang `overflow` issue.
  - Ang `Screen.body` ay may `overflow: "hidden"` na; ang `Screen.inner` ay wala. Dahil ang scroll content ay nasa loob ng `ScrollView`, ang mga ganitong "bleed" ay mapuputol sa gilid ng body, hindi sa loob ng safe margin.
- **Dagdag na obserbasyon (Planner day chips):** ang label ay `2026-11-15` (raw ISO) — mahaba at hindi friendly. Gamitin ang `weekdayShort + day` ("Sun 15"). Mas maikli = hindi na gaanong magka-overflow.

### 1.8 Home: tanggalin ang "Good day: Name"; lagyan ng tab name bilang page title (maliban subpages at AI)
- **Ngayon:**
  - Student Home (`features/student/screens/home-screen.tsx:77–95`): "Good day" + pangalan + search icon.
  - Instructor Home (`features/instructor/screens/home-screen.tsx:52–56`): "Welcome back" + `greetName(user)`.
  - Courses: `Text style={TYPE.h1}>Courses` (student `courses-screen.tsx:33`); Instructor Classes/Assessments/Alerts gumagamit ng `PageTitle`; Account at Notifications student/instructor — Account **walang title** (profile card agad).
  - Ang pangalan ay nasa `AppHeader` na (kanang itaas) kaya duplicate.
- **Dapat gawin:**
  - Alisin ang greeting block. Mag-render ng **isang** `PageTitle` (walang `onBack`) na may pangalan ng tab: `Home`, `Courses` / `Classes`, `Assessments` (instructor), `Alerts` / `Notifications`, `Account`. (Tandaan: ang tab bar label ay "Alerts" pero ang page title ay "Notifications" — pumili ng isa; iminumungkahi `Notifications` bilang title, `Alerts` bilang tab label ay okay pero hindi consistent; i-align.)
  - Panatilihin ang **search icon** ng student Home bilang `trailing` ng PageTitle.
  - Sa **AI tab:** panatilihin ang "STUDIA AI + subtitle" header (sabi mo exempt).
  - Para hindi na ulitin ang bawat screen, gumawa ng `TabScreenTitle` / palawakin ang `PageTitle` (may `variant="tab"`) at gawing *iisang* source ng title text (`TAB_TITLES` constant na ginagamit din ng tab bar labels).
  - Sa Home, kung tatanggalin ang greeting at walang `Home` title, mauuna agad ang QuickActions — idagdag ang `PageTitle title="Home"` para pantay.
  - Pagkatapos tanggalin ang greeting: `displayName`, `greetName`, `useRoleUser` imports ay magiging unused sa dalawang home screen (lint cleanup). Tingnan din kung ang `greetName` sa `session-store.ts` ay may iba pang gumagamit; kung wala, patay na code.

### 1.9 To-do: sub-nav (Today/Upcoming/…) at sort arrow nag-aagawan → gawing Filter sa baba
- **Root cause (`features/student/screens/todo-screen.tsx`, `filterRow`):** `SegmentedTabs` (may `marginHorizontal: -18`) ay nasa loob ng `fill` na kasama ng sort `Pressable` sa iisang row. Ang negatibong margin ay nagpapalawak sa strip ng 18px sa kaliwa at kanan → **pumapasok sa ilalim ng arrow** (screenshot #6: "Done" overlap sa ↑). Walang gap dahil ang gap ay nasa labas ng na-extend na box.
- **Ang gusto mo:** gawing **Filter** (kapag pinindot, may sort options: Soonest first / Latest first / (opsyonal) By class / By type) at ilagay **sa baba**.
- **Dapat gawin:**
  1. Alisin ang arrow Pressable at ang `descending` toggle sa top.
  2. Panatilihin ang `SegmentedTabs` (Today/Upcoming/Overdue/Done) sa taas — **walang katabing element**, kaya hindi na mag-o-overlap.
  3. Magdagdag ng **sticky bottom bar** (sa loob ng `Screen` na `scroll={false}`; naka-position sa taas ng safe-area) na may isang "Filter & sort" button → `BottomSheet` na may radio options: *Sort:* Soonest due / Latest due; *Show:* All types / Assignments / Quizzes; *Class:* All / bawat class. Gamitin ang `Chip`/`ListRow` na existing; i-persist ang pinili sa session (hindi sa AsyncStorage — walang requirement).
  4. Ang `matches()` function at `useMemo` na `filtered` ay kailangang tumanggap ng bagong filter state; ilipat sa `features/student/logic/task-filters.ts` (testable, at mababawasan ang file).
  5. Maliit na bug: `Today` filter ay `isToday(dueAt)` lang **pero** sa Home ang `today` list ay kasama ang `isOverdue`. Pantay-pantayin para hindi magkaiba ang bilang sa Home vs To-do.
  6. Ang `done` task na quiz ay pumupunta sa `quiz-result` pero kapag na-toggle *manual* ang quiz na hindi pa na-take (`manualDone`), ang `openTask` ay magpapadala sa `quiz-result` na walang attempt → empty/error screen. Kaya sa Mock, huwag payagang i-manual-toggle ang quiz (tingnan 3.2).
- **Obserbasyon sa screenshot #6:** "4/8 done" at "50%" ay hindi nakahanay sa iisang row (ang `ProgressBar` label ay may separate na percent sa kanan) — okay naman; walang action.

### 1.10 Study Planner — bakit hindi gumagana ang "Regenerate schedule"
Hindi isa kundi **tatlong bug** na pinagsama kaya walang nakikitang pagbabago (at ang buong planner ay mukhang sira — screenshot #4/#5: "No study blocks for this day"):

1. **Timezone bug sa petsa (`features/student/data/planner-repository.ts` lines 23, 29, 39; `planner-screen.tsx` line 34):** `mondayOf()` ay gumagawa ng *local* Date at nagko-convert gamit `toISOString().slice(0,10)` (UTC). Sa Pilipinas (UTC+8), ang local Monday 00:00 ay nagiging **Linggo** 16:00 UTC → "2026-11-15" imbes na "2026-11-16". Kumpirmado sa screenshot: ang unang araw ay **Sun, Nov 15** at ang linggo ay Nov 15–21, samantalang ngayon ay Nov 22. **Ang kasalukuyang linggo (Nov 16–22) ay hindi tugma, at ang "ngayon" (Nov 22) ay wala pa sa mga tab.** Pareho ang bug sa `addDays`, `weekDays()` at `dueDay`.
2. **Window bug:** `generateBlocks` ay naglalagay ng review block sa araw bago ang due (`reviewDay`), pero **clamp lang sa simula ng linggo** (`>= weekStartIso`). Walang clamp sa dulo. Ang mga mock task ay due sa +28–72 oras mula ngayon (Nov 23–25) at ang planner week ay Nov 15–21 (dahil sa #1) → ang mga block ay napupunta sa mga araw na **wala sa day picker** → "No study blocks for this day" sa bawat tab.
3. **Deterministic output + walang feedback:** `regenerate()` ay gumagamit ng parehong `taskRepository.list()` at parehong heuristic (`tasks.slice(0, 6)`, hours cycle 16–20) kaya **kahit gumana, parehong schedule ang lalabas** (bagong id lang). Walang loading state na nakikita (mabilis ang mock), walang toast na "Schedule regenerated", walang diff. Ang `exams` ay naka-preserve pero **hindi ginagamit sa pag-generate** — kaya ang "Add exam date" ay walang epekto sa schedule (dapat magdagdag ng revision blocks bago ang exam).
- **Dagdag na mga problema:**
  - `useRegeneratePlanner().run()` ay `void`-ed; ang failure (hal. offline: "You are offline") ay **tahimik** — walang toast. Pareho sa `useAddExam` (walang `else` sa `submitExam` kapag `!result.ok`).
  - `useMutation` ay refuse offline *kasama ang regenerate* — okay, pero walang message sa user.
  - `Add exam date` ay free-text `YYYY-MM-DD` — regex lang ang validation; tatanggap ng `2026-13-45` at petsa sa nakaraan. Gamitin ang date picker (tingnan 1.5).
  - `selectedDay` state ay na-init mula sa `days[0]` bago pa mag-load ang `week` (empty string) — gumagana dahil sa fallback `day = selectedDay || days[0]`, pero hindi nagre-reset kapag nagbago ang linggo; piliin ang *today* bilang default kung nasa range.
  - `moveBlock` ay palaging `startHour: 16` (hardcoded) — nawawala ang orihinal na oras; dapat time-slot picker o panatilihin ang `startHour`.
  - `exams` ay naka-store sa isang module-level variable sa mock; hindi per-week — mawawala sa susunod na linggo.
  - `hourLabel` ay umiiral pero ang `planner-block-card` ay dapat i-verify na ginagamit (hindi ko in-open; mababa ang prayoridad).
- **Dapat gawin:** (1) gumawa ng `toLocalIso(date)` helper sa `shared/utils/format.ts` (format gamit local getFullYear/Month/Date) at gamitin saanman may `toISOString().slice(0,10)`; i-define ang linggo bilang Mon–Sun o Sun–Sat nang malinaw; (2) generate window = *mula ngayon hanggang +7 araw* (rolling), hindi calendar week; clamp sa magkabilang dulo; (3) gawing may kahulugan ang regenerate: isama ang exams, balansihin ang oras/araw (huwag lahat sa 4–8 PM), randomize/rotate ayon sa araw, at magpakita ng toast + "Last generated …" label; (4) i-handle ang `!result.ok` sa lahat ng planner mutations; (5) default na napiling araw = ngayon.

### 1.11 Quiz / Assignment: due, close time, late submission, customizable # of questions, editable
Ito ay pinagsama mo sa tatlong mensahe; narito ang kumpletong audit.
- **Instructor Create Quiz (`create-quiz-screen.tsx`, `quizzes-repository.ts`, `types/instructor.ts → QuizDraft`):**
  - Walang `dueAt`, `closesAt`, `allowLate`, `timeLimitMin`, `maxAttempts`, `points` summary. Ang `QuizDraft` ay `{ title, classId, questions, source }` lang.
  - **Walang edit quiz.** Ang `QuizRepository` ay may `list/listByClass/get/create/remove` — **walang `update`**. Ang `quiz-detail-screen` ay preview + delete lang. Hindi mae-edit ang mga tanong pagkatapos i-save/publish.
  - **Number of questions:** manual quiz ay dynamic ("Add question" / remove) — ok; pero ang **AI quiz** ay naka-fix sa chips `[5, 10, 15]` (`ai-quiz-screen.tsx` `COUNTS`) → palitan ng *stepper/number input* (1–50, may validation) para customizable. Ang `canRemove` sa editor ay nagpapahinto sa 1 question; okay.
  - Time limit (`timeLimitMin`) ay nasa student quiz at DB (`quizzes.time_limit_min`) pero **walang UI** sa instructor para itakda — ang student quiz ay may hardcoded na 15/10/12 minuto sa mock.
  - Seeded instructor quizzes ay may `questions: []` (`quizzes-repository.ts` lines 22–25) kaya ang `quiz-detail` ay blangko at "N items" = 0 kahit "published".
- **Dapat gawin (instructor quiz):**
  1. Idagdag ang section **"Schedule & rules"**: Opens at (optional), **Due** (date+time), **Closes at** (hanggang kailan tanggap), **Late submissions** (dropdown: Not allowed / Allowed until closes at, tagged Late), Time limit (minutes, optional), Attempts (default 1).
  2. Migration: `quizzes` ay may `due_at`, `time_limit_min`, `max_attempts` na; **idagdag** `allow_late boolean`, `closes_at timestamptz`, `opens_at timestamptz` + check constraints (`opens_at < due_at <= closes_at`).
  3. **Edit quiz:** `update(id, draft)` sa repo + `useUpdateQuiz` + Edit button sa `quiz-detail` (palitan ang create screen ng reusable `QuizForm` — ang file ay malalagpasan ang 250 lines).
  4. **Rules kapag may attempts na:** huwag payagang baguhin ang correct answer/points ng published quiz *nang hindi nagre-re-grade*; ipakita ang warning, o payagan lang edit ng schedule. I-document sa `api-contract.md`.
  5. Mga draft ay hindi dapat makita ng students (siguraduhin sa server RLS na `status='published'` lang).
- **Student side:** ang `student/quizzes-repository.ts` ay hindi tumitingin sa `dueAt` sa `submitAttempt` — **lampas due ay tinatanggap pa rin** at walang "Late" flag; walang `allowLate`/`closesAt`; ang timer ay client-only (`quiz-take-screen.tsx`) — pwedeng i-bypass sa pag-reopen ng screen (nire-reset ang countdown tuwing mag-mount, dahil `timerStartedFor` ay local state; kapag lumabas at pumasok ulit, ibabalik ang buong oras). Dapat ang server ang may `started_at` at nag-eenforce ng limit.
- **Assignment** — tingnan 1.5.

### 1.12 Instructor: makita kung sino ang nakapasa / hindi pa, at grade ng bawat student sa assignment
- **Ngayon:** Wala. `instructor/screens/assignment-detail-screen.tsx` ay instructions + attachments + delete. Ang `submissions-repository.ts` ng instructor ay para sa **quiz** lang (`quizId`, `answers[]`); walang assignment submissions model sa instructor side. Ang student side ay may submission state (`status`, `submissionText/File`, `score`, `feedback`) sa sarili nitong repo (`student/assignments-repository.ts`), na hindi konektado sa instructor.
- **Dapat gawin:**
  1. **Type:** `AssignmentSubmission { id, assignmentId, studentId, studentName, status: "missing" | "draft" | "submitted" | "late" | "graded", submittedAt, text, file, score, feedback, gradedAt }` — at isama ang mga estudyanteng *walang submission* bilang `missing` (join sa roster ng class).
  2. **Repository:** `listByAssignment(classId, assignmentId)` (roster ⟕ submissions), `gradeAssignment(submissionId, score, feedback)` (re-use `parseScore` at max = `assignment.points`).
  3. **UI:** sa assignment detail, magdagdag ng section "Submissions" na may summary (Submitted X / Late Y / Missing Z / Graded N), filter chips (All / Submitted / Late / Missing / Graded), at row per student (avatar, pangalan, status badge, score `18/20`). Tap → grade screen (i-generalize ang `grade-submission-screen` para sa assignment at quiz — **huwag mag-duplicate**; tumanggap ng `kind`).
  4. **Student side:** pagkatapos ma-grade, ang `status: "graded"` + `score` + `feedback` ay dapat lumabas sa student (nandoon na ang UI).
  5. **Draft status:** sa "not allowed late" na draft, ang instructor ay dapat makakita ng "Draft (not turned in)" — hindi bilang submitted.
  6. Server: ang listing ay dapat nililimitahan ng `is_class_owner` (RLS), at ang file ay *signed URL* na may maikling expiry.

### 1.13 Video: link lang (hindi upload); may AI summary; may "Watch on YouTube"; upload materials max 50 MB
- **Ngayon (mga mismatch):**
  - `features/instructor/logic/validators.ts:79` → `MATERIAL_FILE_POLICY.maxBytes = 500 MB` at nagpapahintulot ng `video` kind (`mp4/mov`) — mga pahina ng UI (`upload-material-screen.tsx`: "up to 500 MB") ay 500 MB rin.
  - **Migration `…007_material_cap_40mb.sql`:** ang Supabase bucket cap ay **40 MB** at `settings.max_material_size_mb = 40`. Kaya ang app ay nagsasabing 500 pero tatanggihan ng server — **inconsistent** at magre-resulta sa error pagkatapos ng mahabang upload. (Ang `…003_content.sql` comment mismo ay nagsasabing ang 500 MB ay nangangailangan ng Pro.)
  - `features/student/components/video-player.tsx` → **hardcoded na** `BigBuckBunny.mp4` — *anumang* video lesson ay nagpe-play ng sample clip (ang `VideoPlayer` ay walang prop). Hindi talaga gumagana ang video playback ng totoong materyal.
  - Walang konsepto ng "link" sa `Material`/`Lesson`/`Attachment` types.
- **Dapat gawin:**
  1. **Idagdag ang `kind: "link"`** (o `videoUrl` field) sa Material/Lesson: `{ kind: "video", source: "link", url, provider: "youtube" | "gdrive" | "other" }`. Tanggalin ang `video` mula sa `kinds` ng `MATERIAL_FILE_POLICY` at sa `ATTACHMENT_MIME_TYPES` ng materials picker (mp4/mov) — ang upload ay para sa PDF/DOC/PPT lamang. (Kung gusto mong payagan pa rin ang maliit na mp4 ≤ 50 MB, sabihin mo — default ko: hindi.)
  2. **Upload cap = 50 MB** sa client (`maxBytes: 50 * 1024 * 1024`), at **ihanay ang server**: migration `20260101000011_material_cap_50mb.sql` (bucket `file_size_limit = 52428800`, `settings.max_material_size_mb = 50`). Tandaan: ang libreng plan ng Supabase ay *eksaktong 50 MB* per file — walang margin; ang `formatFileSize` ay `(bytes/1048576)`; i-set ang client check sa `<= 50 MB` at ipakita ang "Up to 50 MB".
  3. **Link validation:** tanggapin ang `https` lang; allowlist/parse ng YouTube (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `m.youtube.com`) → kunin ang video ID; **huwag** mag-render ng arbitrary URL sa WebView nang walang allowlist (XSS/phishing). Para sa ibang host, "Open link" lang gamit `expo-web-browser` (nasa dependencies na) at hindi embed.
  4. **Student viewer:** (a) embed/inline playback para sa YouTube — gamit ang WebView/`react-native-youtube-iframe` (bagong native deps → dev build) o mas simple: **thumbnail (`img.youtube.com/vi/{id}/hqdefault.jpg` via `AppImage`) + "Watch on YouTube" button** na nagbubukas ng `Linking.openURL`/`WebBrowser`; (b) laging ipakita ang **AI summary + transcript/key points** kahit hindi mapanood sa app; (c) may "Watch on YouTube" fallback kapag nag-fail ang embed (video restricted/age-gated/offline).
  5. **AI summary mula sa link (mahalaga — logic):** ang AI ay hindi makakakuha ng content mula lang sa URL sa client. Kailangang gawin ng server (`studia-api`): kunin ang YouTube transcript/captions (YouTube Data API/captions, o third-party transcript fetch) → i-summarize. Isaalang-alang: (i) hindi lahat ng video ay may captions; (ii) quota ng YouTube API; (iii) rate-limit/gastos ng AI at **cache** ng summary sa `lesson_ai` table para hindi mag-regenerate bawat view; (iv) estado `processing | ready | failed` (nandoon na ang pattern) at fallback na "Instructor can paste a transcript/notes" kung walang captions. Ilagay sa `docs/api-contract.md`.
  6. **Instructor upload screen:** dalawang tab/choice — "Paste link" (video) at "Upload file (≤ 50 MB)". Preview ng thumbnail bago i-save.
  7. `lesson-viewer-screen.tsx`: ang "Regenerate" ay *client-only mock* (`mutate` ay nagdadagdag lang ng " (regenerated)" sa text) — hindi talaga nagre-regenerate; palitan ng totoong mutation, at huwag payagan ang unlimited na regenerate (cost).
  8. Ang transcript line sa student viewer ay `Pressable` na walang `onPress` (dead interaction; dapat mag-seek sa timestamp o gawing `View`).

### 1.14 Gradebook: filter (lahat o specific assignment) — per class lang
- **Ngayon (`instructor/screens/gradebook-screen.tsx`):** class chips (batay sa `code`, hindi `classId`), listahan ng **graded quiz submissions** lang. Wala itong assignments. Ang `GradesTab` sa class detail ay nagbubukas ng gradebook at ipapasa ang `classId`, na kino-convert sa `code` (`presetCode`).
- **Mga bug sa logic:**
  - Gumagamit ng **`classCode` bilang identity**. Ang parehong subject code ay pwedeng magkaroon ng maraming section (hal. IT 321 BSIT 3-A at 3-B, normal sa campus) — pagsasamahin ang grades ng magkaibang class. Dapat `classId` ang ginagamit (idagdag `classId` sa `Submission`).
  - `GradesTab` (class detail) ay may parehong `classCode` filter at **kinukuha ang lahat ng submissions ng instructor** (`useAllSubmissions`) para i-filter sa client → sobra at hindi scalable; gumawa ng `listByClass(classId)`.
  - Kapag na-preset ang `classId` galing sa class detail, ang "All classes" chip ay nagpapakita pa rin ng ibang class — salungat sa sinabi mo ("within that class lang"). Sa class-scoped mode, **alisin ang class chips**.
  - Ang `useState(presetCode)` ay na-init bago mag-load ang `classes.data` → `presetCode` ay `null` sa unang render at hindi na mag-a-update (state initializer lang) → lalabas na "All classes" kahit may preset kapag mabagal ang load.
- **Dapat gawin:**
  1. Source: pagsamahin ang **assignment scores + quiz scores** bilang `GradeEntry { id, classId, kind: "assignment"|"quiz", refId, title, studentId, studentName, score, max, gradedAt }`.
  2. **Filter UI:** isang "Show: All / Specific…" dropdown (SelectField/BottomSheet) na naglilista ng assignments at quizzes ng *class na iyon* (kapag class-scoped) o class → item (kapag global). Multi-select ay opsyonal; default "All".
  3. Kapag specific item ang pinili: ipakita ang per-student rows (graded + missing), average/high/low, at link sa grade screen.
  4. Kapag All: ipakita per-student *overall* (weighted? — **kailangan ng desisyon mo**: simple average o by points).
  5. Student side: ang `GradesTab` ng student ay "graded assignments + quiz" at hindi tinitingnan ang `essay` na pending (`attempt.score !== null`) — OK, pero walang "pending grading" indicator.

---

## 2. UI responsiveness at consistency (karagdagang nakita)

| Lugar | Isyu | Rekomendasyon |
|---|---|---|
| `Screen` (`screen.tsx`) | `maxWidth: isTablet ? MAX_CONTENT_WIDTH : 640` — magic number `640`; `paddingHorizontal: 18` hardcoded (hindi galing sa `SPACE`); `inner` `gap: SPACE.md + 2` | Ilipat sa `tokens.ts` (`LAYOUT.screenPadding`, `LAYOUT.phoneMaxWidth`); gamitin din ng `SegmentedTabs` |
| `Screen` | Ang `KeyboardAvoidingView` ay **sumasaklaw sa header + body**? (nasa `body` lang) — pero walang Android behavior | Tingnan 1.6 |
| Maraming screen | Inline `style={{ flexDirection: "row", gap: ... }}` / `{{ gap: SPACE.lg }}` sa JSX (hal. `assessments-tab`, `create-quiz`, detail screens) | Sumasalungat sa CLAUDE.md ("no magic numbers", memoized rows); gumawa ng `Row`/`Stack` primitives sa `shared/components/ui` |
| `class-detail` instructor tab | `ActionButton` "New" at "AI" ay nasa header ng section — sa makipot na screen ay maaaring mag-wrap/mag-overflow | I-test sa 320px width; gamitin ang `PageTitle trailing` pattern |
| `home-screen` (instructor) `StatCard` ×3 | `flexWrap` + `gap` — sa 320px ay maaaring bumagsak sa 2 rows na hindi pantay | `flex: 1` + `minWidth` |
| `ai-chat-composer` suggestions | Walang inset sa kaliwa/kanan; "Class summ" putol | Pareho sa 1.7 |
| `notifications-screen` | `AppList` sa loob ng `fill` pero `Screen scroll={false}` — OK; pull-to-refresh gumagana | — |
| `app-header` | `tagText` "Instructor · IT" — mahahabang department name ay naka-`numberOfLines={1}` (truncate) — OK | — |
| Dark mode | `app.json: userInterfaceStyle: "automatic"` pero ang `C` constants ay light-only (`shared/hooks/use-color-scheme.ts` umiiral) | Pumili: i-force `light` sa `app.json` o suportahan nang buo. Ngayon ay hindi pare-pareho |
| Accessibility | Maraming `Pressable` (comments, suggestions chips) ay walang `accessibilityRole`/label (`ai-chat-composer` `sugChip`) | Idagdag |
| Touch target | `PageTitle` back button 34×34 (< `MIN_TOUCH`); may `hitSlop` kaya okay | Gamitin ang `MIN_TOUCH` |

---

## 3. Cross-cutting LOGIC findings (mas mabigat kaysa sa UI)

### 3.1 ⚠️ Magkahiwalay na mock stores ang student at instructor — hindi nagsasalubong ang data
- Student: `features/student/data/{assignments,quizzes,announcements,lessons,classes}-repository.ts` (module-level `let` arrays, ids `as1`, `qz1`, `an1`…).
- Instructor: `features/instructor/data/*-repository.ts` (ids `ias1`, `quiz_it321_1`, `ian1`, `im1`…).
- **Epekto:** ang assignment/quiz/announcement/material na ginawa ng instructor ay **hindi lalabas** sa student (at vice versa: ang comment ng student ay hindi nakikita ng instructor; ang submission ng student ay hindi lilitaw sa instructor grading). Sa demo/`switchDemoRole` ay malinaw ito. Lahat ng request #12 (submissions view), #11 (due/late), #4 (comments) ay hindi ma-ve-verify end-to-end hangga't magkahiwalay.
- Pati ang class sections ay hindi pareho: instructor `it314 = BSIT 3-B` vs student `it314 = BSIT 3-A`; instructor ay may `it322`, student ay may `ge105`; teachers ay iba sa bawat side.
- **Dapat gawin:** (a) gumawa ng **iisang mock "database" module** sa `core/data/mock/` (`mock-db.ts`) na may single source para sa classes/assignments/quizzes/announcements/materials/submissions; ang dalawang repository ay *views* lang ng role; o (b) lumipat na agad sa remote repositories (Supabase) at i-drop ang mock para sa mga domain na ito. Ang (a) ay praktikal kung may mock mode pang kailangan.

### 3.2 Student `toggleDone` / manual check-off
- Sa `tasks-repository.ts`, `manualDone` ay isang module-level `Set` na nagpapahintulot ng pag-check ng assignment/quiz na hindi pa na-turn in (nagiging "done" sa to-do pero `status: "assigned"` pa rin). Mali ito sa semantics ("auto-generated checklist from assignments + quizzes — never a hand-maintained list"). Ang `toggleDone` ay nagre-refetch ng *buong* list (N classes × assignments × quizzes) para sa isang toggle (O(n) network sa remote). Dapat: ang manual check ay para lang sa personal "study tasks", hindi sa graded items; o tanggalin.

### 3.3 Late / due rules ay hindi consistent
- `assignment.allowLate=false` + overdue → draft (student). Ngunit ang quiz ay walang rule. Ang DB ay may `allow_late` sa `assignments` lang. Pantayin sa isang `SubmissionPolicy { dueAt, closesAt, allowLate }` type na ginagamit ng assignment at quiz (client + server).
- Ang pag-turn-in ng draft ay **hindi tinitingnan ang `closesAt`** (wala pa) at hindi nagta-tag na "late" (sinasadya ayon sa UI-BRIEF: "Turn in … without a late tag"). Kung tama ito sa campus policy, ilagay sa dokumentasyon; kung hindi, ayusin.

### 3.4 Time zone at petsa
- `shared/utils/format.ts` ay naka-`en-PH` locale pero **walang `timeZone: "Asia/Manila"`** sa `toLocale*` → ang display ay sumusunod sa device zone (ayon sa comment ay "dates must not shift per device" — hindi totoo ngayon). Idagdag ang `timeZone` option sa lahat ng format, o gumamit ng iisang helper.
- `toISOString().slice(0, 10)` (planner) = UTC date, hindi local date → bug (1.10). Mag-grep pa sa buong code para sa katulad na pattern bago ayusin.
- `isOverdue`/`isToday` ay gumagamit ng device `Date.now()` — madaling i-manipulate ng user (baguhin ang orasan ng phone). Para sa late tagging, **server time lang** ang dapat mag-decide (nasa api-contract na ang "never trust client" prinsipyo; idagdag para sa late).

### 3.5 Dead code / hindi ginagamit (natukoy sa export scan)
| Item | File |
|---|---|
| `useUpdateAssignment` (ang edit feature ay hindi pa naisasagawa) | `instructor/hooks/use-assignments.ts` — **gagamitin sa #5, huwag tanggalin** |
| `useQuizSubmissions`, `useArchiveClass`, `useDeleteClass` | `instructor/hooks/*` — walang UI na tumatawag (Delete/Archive class ay nasa docs at repo pero walang button) |
| `BackTitle` (deprecated) | `shared/components/ui/page-title.tsx` |
| `useDraftAutosave` | `shared/hooks/use-draft-autosave.ts` — walang gumagamit (kahit ang UI-BRIEF ay humihingi ng draft autosave sa forms) → gamitin sa create assignment/quiz/announcement |
| `newIdempotencyKey` | `shared/utils/id.ts` — hindi ginagamit; dapat gamitin sa mutations (create assignment/quiz/post) para iwas double-submit pag-retry sa remote |
| `emptyAnswer` | `student/components/quiz-question-card.tsx` |
| `validateEssayAnswer` | `student/logic/validators.ts` — hindi ina-apply ang essay validation sa quiz submit |
| `apiRequest` | `core/data/api-client/api-client.ts` — stub; walang caller |
| `parseInteger`, `parseText` | `core/logic/route-params.ts` |
| Commented / patay na: `HOME_ROUTE` comment, dobleng `TODO persist accessToken` | `auth/screens/auth-screen.tsx:84, 295, 300` — ang session persistence ay nasa `core/data/supabase/secure-storage.ts` na; linisin ang lumang TODO |
| Stale TODO | `onboarding/screens/{explore,welcome}-screen.tsx` ("palitan kapag gawa na ang login") — tapos na ang auth |
| `features/{student,instructor}/screens/notifications-screen.tsx` at `account-screen.tsx` | ay `app/*` wrappers lang ng shared screens; tingnan kung talagang imported ang `features/*/screens/*` (ang `app/` route files ay direktang nag-import ng shared). Kung hindi na-import kahit saan → patay na file |
| Duplicate: `features/student/data/class-directory.ts` vs `features/instructor/data/class-directory.ts` | Pagsamahin sa 3.1 |
| `mock-data.ts` `CHAT_CONFIG` + `mockReply` | Ang AI chat ay hardcoded keyword matching; `ai-assistant-screen.tsx` TODO ay nagsasabi na dapat ay ai-service layer. Sa remote, ang hindi-gawa na AI endpoint ay mag-iiwan ng "fake AI" sa production — mag-flag na "Preview" o gumawa ng service |

> Tandaan: ang listahan ay galing sa simpleng "export na isang beses lang lumalabas sa buong `src`" na scan; i-verify bago tanggalin (ang ilan ay gagamitin ng mga hiniling na feature).

### 3.6 Bagong isyu sa data layer
- `useMutation` — `[mutate]` lang ang dependency ng `useCallback`, at ang `options` ay may eslint-disable; kapag ang caller ay gumagawa ng *bagong* `mutate` function bawat render (karamihan ng hooks ay ganoon, hal. `(id) => repo.markRead(role, id)`), nagre-recreate ang `run` bawat render at may panganib na **stale `options.optimistic.apply`** (gumagamit ng `key` na sa unang render). Gumagana ngayon dahil stable ang `role`; mag-ingat kapag nagdagdag ng params (hal. filter).
- `useMutation` ay walang **double-submit guard** — mabilis na dobleng tap sa "Post"/"Turn in" ay dalawang request (loading flag ay hindi pumipigil sa pangalawang `run` bago mag-render). Idagdag `if (loadingRef.current) return`.
- `notification` feed `FEEDS` at iba pang `let` arrays ay global mutable — okay sa mock, pero nagre-reset lang kapag nag-reload ang app (walang persistence) at **hindi nililinis sa sign-out** → ang susunod na user ay makikita ang pagbabago ng nauna (ang `signOut` ay nagpapurge lang ng query cache, hindi ng mock stores).
- Ang `AppList` / `ListState` pattern ay maayos. Ang `ListState empty` + `loading` ay inaayos nang tama sa karamihan; sa `planner-screen` ang `empty={!loading && !week}` ay hindi kailanman true kung `week` ay may laman — ok.

### 3.7 Role / demo leaks sa production
- `account-screen.tsx` → "Switch to Student/Instructor View" ay hindi naka-`__DEV__`. Sa production (remote), ito ay magpapakita sa user ng demo identity (`juan.delacruz@omsu.edu.ph`, `maria.santos@omsu.edu.ph`) nang walang authentication, at `useRoleUser` fallback sa demo user (`__DEV__` lang — okay). Isara ang switch sa `__DEV__ && !isRemote`.
- Ang screenshots mo ay nagpapakita ng iba't ibang pangalan sa instructor header ("Justine Antipado · Instructor · IT" vs "Maria Santos · Instructor · IT Department") — sinasalamin nito na may halong *remote profile* at *demo fallback*. I-verify na hindi nag-ooverwrite ang `switchUser` sa tunay na session.

### 3.8 Seguridad at server-side na dapat nakasaad (para sa mga bagong feature)
- **Profile edit na may OTP:** ang OTP ay dapat server-verified at *single-use*, na naka-tie sa user at sa *purpose* (`profile_update`), 5-min TTL, 5 attempts. Ang client ay hindi dapat mag-apply ng edit bago ang `verify` success. Huwag mag-allow na palitan ang `email` nang walang bagong OTP sa *bagong* email.
- **Link na video:** server-side URL validation (https, allowlist host, haba), hindi pag-fetch ng arbitrary URL ng server (SSRF) — kung YouTube lang, gamitin ang video ID.
- **Upload 50 MB:** server ay dapat mag-sniff ng content-type, magpilit ng limit (bucket), at mag-generate ng sariling filename (nakasulat na sa `file.ts`).
- **Assignment submissions view:** RLS — instructor ng class lang; student ay sarili lang.
- **Announcement comment ng instructor:** nasa RLS na; i-update ang `api-contract.md`.

---

## 4. Mungkahing pagkakasunod-sunod (priority)

**Batch A — Quick wins / correctness (0.5–1 araw)**
1. #1 Gmail placeholder (+ signup hint, docs).
2. #7 SegmentedTabs margin/overflow fix (inaayos din #9 overlap).
3. #8 Remove greeting + tab titles; hardcoded notification badge → real count.
4. #4 Instructor comment (UI + repo + shared composer).
5. #9 To-do filter sheet sa baba.

**Batch B — Platform fixes (1–2 araw)**
6. #6 Keyboard handling (A: keyboard-controller) para sa Screen + BottomSheet + AI chat.
7. #10 Planner (timezone helper, window, regenerate logic, error toasts).
8. Date/time picker + `SelectField` (kailangan ng #5, #11, planner exam).

**Batch C — Feature work (3–5 araw)**
9. #3 Account subpages + OTP-protected personal info + photo.
10. #2 Notification detail + mark-read flow.
11. #5 Assignment: custom due, closes_at, late dropdown, edit screen (preserve attachments).
12. #11/#15 Quiz schedule/late/edit + AI quiz count customizable.
13. 3.1 Unified mock DB (o remote) — **dapat nauuna sa #12–14 para ma-test nang tama**.
14. #12 Assignment submissions + grading view.
15. #14 Gradebook filter.
16. #13 Video link + 50 MB cap + server migration + AI summary pipeline.

**Batch D — Cleanup**
17. Dead code (3.5), docs (`api-contract.md`, `ROUTE-MAP.md`, `database.md`), README ng mga folder na ginalaw, lint + `npx tsc --noEmit`.

---

## 5. Mga kailangan kong desisyon mo bago mag-code

1. **Mark-as-read timing:** awtomatiko pagbukas ng detail, o may hiwalay na "Mark as read" button sa detail?
2. **Date picker:** OK ba ang `@react-native-community/datetimepicker` (native → dev build, na ginagamit mo naman na dahil `expo-dev-client`)?
3. **Keyboard fix:** OK ba ang `react-native-keyboard-controller` (inirerekomenda) o gusto mong walang bagong native dependency (mas marupok)?
4. **Video:** YouTube lang ba ang embed/thumbnail, at ibang link = "Open link" lang? At mananatili bang pwede ang maliit na mp4 upload ≤ 50 MB o **link-only** talaga ang video?
5. **AI summary para sa link:** OK ba na server-side transcript fetch (captions) at may fallback na "paste transcript" kung walang captions?
6. **Closes-at:** kailangan ba talaga ng hiwalay na "Closes at" (hanggang kailan tatanggap ng late) bukod sa Due? (iminungkahi ko — oo.)
7. **Gradebook "All":** simple average o weighted by points?
8. **Account → Edit Personal Info:** alin ang mae-edit (name, mobile, course/year/section/department)? Ang **email** ba ay hindi mae-edit?
9. **Notification target links:** gusto mo bang may "Open" button papunta sa quiz/announcement/submission mula sa detail?
10. **Tab label vs title:** "Alerts" o "Notifications" ang opisyal na pangalan?

---

## 6. Mga file na malamang mabago (reference)

`features/auth/screens/auth-screen.tsx` · `features/auth/logic/auth-validation.ts` · `shared/components/ui/{screen,bottom-sheet,segmented-tabs,page-title}.tsx` · `shared/components/ui/` (bago: `select-field`, `comment-composer`, `date-field`) · `features/shared-screens/{screens,components,data,types,hooks}/*` · `app/{student,instructor}/_layout.tsx` + bagong route files (one-line re-exports) · `features/student/screens/{home,todo,planner,lesson-viewer}-screen.tsx` · `features/student/data/{planner,tasks,assignments,quizzes,lessons}-repository.ts` · `features/student/components/video-player.tsx` · `features/instructor/screens/{home,create-assignment,assignment-detail,create-quiz,quiz-detail,ai-quiz,gradebook,upload-material,announcement-detail}-screen.tsx` · `features/instructor/data/*` + `hooks/*` + `types/instructor.ts` · `features/instructor/logic/validators.ts` · `supabase/migrations/` (bagong: `…011` material 50 MB, `…012` assignments.closes_at, `…013` quizzes schedule/late) · `docs/api-contract.md` · `docs/ROUTE-MAP.md` · `studia-mobile/app.json` (keyboard/edge-to-edge).

> Paalala sa workflow: ayon sa `CLAUDE.md`, bago i-declare ang anumang mobile task na tapos, patakbuhin ang `npx expo lint` at `npx tsc --noEmit` sa `studia-mobile/`; gumamit ng `npx expo install` para sa mga bagong dependency; at huwag galawin ang `ios/` o `android/`.

---

# ADDENDUM (2026-11-22) — Pagsasama ng mock data + karagdagang audit

> Audit pa rin ito; **walang app code na binago**. Naiintindihan na sinadya pa ang mock data hangga't hindi pa konektado ang DB. Ang tanong: **pwede bang pagsamahin ang student at instructor mock data para ma-test ang buong flow?** → **Oo, pwede, at hindi ito rewrite ng UI.** Ang kailangan lang ay palitan ang loob ng mga `*-repository.ts` (na siya namang layunin ng architecture: "swapping = one file per feature"). Walang screen/hook na magbabago.

## A. Disenyo ng iisang mock database

### A.1 Ano ang gagawin
Gumawa ng **isang module**: `core/data/mock/mock-db.ts` na may iisang in-memory store (typed tables) at maliliit na function para mag-read/mag-write. Ang student at instructor repositories ay magiging **manipis na "view"** nito (nagko-convert lang sa `StudentX` / `InstructorX` type). Ito rin ang magsisilbing 1:1 na hulma ng mga Supabase table, kaya madali ang paglipat sa remote pagkatapos.

| Table (mock-db) | Pinagmulan ngayon (dalawang kopya) | Pinag-iisa |
|---|---|---|
| `users` | `DEMO` sa `session-store.ts` + pangalan sa roster/submissions | 1 instructor (Maria Santos), ~10 student (kasama si Juan Dela Cruz) |
| `classes` (+ `ownerId`, `section`, `joinCode`) | `student/class-directory.ts` + `instructor/class-directory.ts` | 1 listahan; **teacher = pangalan ng owner** (hindi hardcoded) |
| `enrollments` (`classId`, `studentId`) | `joined` Set (student) + `ROSTERS` Map (instructor) | 1 table; ang student `list()` = mga class ng kasalukuyang student; instructor roster = enrollments ng class |
| `announcements` + `comments` (`authorId`, `authorRole`) | dalawang `ANNOUNCEMENTS` array | 1; ang `authorIsMe` ay *kinokompyut* mula sa session user (`comment.authorId === me.id`) |
| `materials` | `LESSONS` (student) + `MATERIALS` (instructor) | 1; ang student view ay nagdadagdag ng `aiSummary` |
| `assignments` | `ASSIGNMENTS` ×2 | 1 (`dueAt`, `closesAt`, `allowLate`, `points`, `attachments`) |
| `assignmentSubmissions` (`assignmentId`, `studentId`, `status`, `submittedAt`, `text`, `file`, `score`, `feedback`) | nasa student `Assignment` lang; wala sa instructor | **Bago** — ito ang nagbubukas ng #12 (submissions view) at #14 (gradebook) |
| `quizzes` + `questions` | `QUIZZES` ×2 (iba ang shape) | 1 (kasama ang `dueAt`, `closesAt`, `allowLate`, `timeLimitMin`) |
| `quizAttempts` | `attempt` sa student quiz + `SUBMISSIONS` (instructor) | 1; ang "Needs grading" ay *kinokompyut* (essay na walang score) |
| `notifications` (`userId`, `kind`, `refType`, `refId`, `body`, `readAt`) | `FEEDS` | 1; **ginagawa ng events** (tingnan A.3) |
| `plannerBlocks`, `exams` (`studentId`) | module variables sa planner repo | 1 (per student) |

### A.2 Identity: sino ang "ako"
- Ang mock-db ay may `me(role)` na kumukuha ng `UserProfile` mula sa session store (`useRoleUser`/`setUser`) → nagma-map sa isang row ng `users` (by email o fixed demo id). Para sa demo: student = **Juan Dela Cruz**, instructor = **Maria Santos** (pareho na sa `DEMO`).
- Kung naka-login ka bilang totoong remote user (hal. Justine Antipado) habang mock data ang mga screen, **huwag** gamitin ang remote id sa mock-db. Dalawang opsyon: (1) mock mode = laging DEMO identities; (2) i-seed ang mock user mula sa session (pangalan lang) at i-map sa fixed id. Iminumungkahi ko (2) para lumabas ang pangalan mo sa comments, pero (1) ang pinakasimple. Kailangan ng desisyon mo.
- Ang "Switch to Student/Instructor View" (Account) ay nagpapalit lang ng aktibong identity — ang **data ay hindi nire-reset**. Ito ang paraan ng pag-test: mag-post bilang instructor → *Switch* → makita bilang student. (Ang `switchUser` ay naglilinis na ng query cache, kaya fresh ang fetch sa pag-switch; walang cross-role stale cache.)
- **Mahalagang pagbabago:** huwag i-reset ang mock-db sa `signOut`/`switchUser` (kasalukuyang kaugalian ng mock arrays — nananatili sa module hanggang i-reload ang app). Magdagdag ng `resetMockDb()` na tinatawag lang ng DEV tools (A.4).

### A.3 Mga event na nagbibigay-buhay sa flow (ito ang nagpapa-test ng "end-to-end")
Bawat write sa mock-db ay may kasamang side-effect, gaya ng gagawin ng server/trigger sa remote:

| Aksyon | Epekto sa kabilang panig |
|---|---|
| Instructor: post announcement | Lalabas sa student Stream; notification (`notice`) sa lahat ng enrolled |
| Instructor/Student: mag-comment | Nakikita ng dalawa; notification sa kabilang panig/author ng post |
| Instructor: gumawa/mag-edit ng assignment | Lalabas sa student To-do/Tasks (kasama ang bagong due); notification (`reminder`) kung binago ang due |
| Student: Turn in (submitted/late/draft) | Lalabas sa instructor "Submissions" ng assignment; notification (`grade`/`class`) sa instructor |
| Instructor: mag-grade | Lalabas ang score/feedback sa student; notification (`grade`) |
| Instructor: mag-publish ng quiz | Lalabas sa student; may due/late rule |
| Student: mag-submit ng quiz | Auto-score MCQ/ID; essay → instructor "Needs grading" |
| Student: join class (code) | Dumadagdag sa instructor roster at `studentCount` (kinokompyut, hindi hardcoded) |
| Instructor: remove student | Nawawala ang class sa student list |
| Student: leave class | Nawawala sa roster |

> Ang lahat ng bilang (`studentCount`, `submittedCount`, `pendingCount`, `progress`) ay dapat **derived** mula sa mga table — ngayon ay static seed numbers (`students-repository.ts` `seedFor`, `PROGRESS` map sa student classes) kaya kahit mag-submit ay hindi nagbabago.

### A.4 DEV tools (maliit pero malaki ang tulong sa testing)
Sa Account (nakatago sa `__DEV__ && !isRemote`):
- **Switch role** (nandiyan na, ilipat dito).
- **Reset mock data** (`resetMockDb()` → i-restore ang seed).
- **Simulate time** (`+1 day`, `+1 week`): isang `mockNow()` na ginagamit ng `isOverdue`, `dueLabel`, planner, at late rule — para ma-test ang "late", "closed", "overdue" nang hindi naghihintay. (Ngayon ay `Date.now()` ang direktang tinatawag sa maraming lugar.)
- **Failure rate** at **latency** slider: ang `MOCK_FAILURE_RATE` ay `const = 0` sa source (kailangang i-edit ang file). Gawing runtime setting/env (`EXPO_PUBLIC_MOCK_FAILURE`) para ma-test ang error/retry UI.

### A.5 Seed na sumasakop sa lahat ng estado (para may mapagsubukan agad)
- 1 instructor (Maria), 3 class na pagmamay-ari niya: `IT 321 BSIT 3-A`, `IT 314 BSIT 3-A`, `IT 318 BSIT 3-A` (+ `IT 322 BSIT 4-A` na wala si Juan). **Ayusin ang mismatch ngayon:** instructor `it314 = 3-B`/`it318 = 3-C` pero student `3-A` lahat.
- ~10 student; si Juan ay enrolled sa 3 class; iba-iba ang estado ng kanilang submissions: `missing`, `draft` (not-allowed-late at overdue), `submitted`, `late`, `graded`.
- Assignments: isang bukas (due bukas), isang overdue na `allowLate=false`, isang overdue na `allowLate=true`, isang graded, isang may `closesAt` na lumipas na.
- Quizzes: hindi pa kinuha / tapos na / may essay na naghihintay ng grading / draft (hindi dapat makita ng student) / lampas due.
- Announcements: may comment mula sa student **at** instructor, may pinned.
- Materials: isang YouTube link na `ready`, isang `processing`, isang `failed`, isang PDF.
- Notifications: *derived* mula sa events, hindi hand-typed.

### A.6 Mga hakbang ng pagsasagawa (ligtas na pagkakasunod, hindi sabay-sabay)
1. Gumawa ng `mock-db.ts` + `mock-seed.ts` at `mock-selectors.ts` (derived counts). Walang binabago pa sa repos.
2. Ilipat ang **classes + enrollments** (student `classes-repository`, instructor `classes-repository`, `students-repository`) → test: join class bilang student, lalabas sa roster.
3. **Announcements + comments** (sabay ang #4 instructor comment).
4. **Assignments + assignmentSubmissions** (sabay ang #5, #12).
5. **Quizzes + attempts** (#11/#15, gradebook #14).
6. **Materials/lessons** (#13).
7. **Notifications** na derived (#2) at **planner** (#10).
8. Burahin ang dalawang `class-directory.ts` at ang mga lumang module-level array; `npx expo lint` + `npx tsc --noEmit` pagkatapos ng bawat hakbang.
- Ang mga hooks, screens, cache keys, at `useMutation`/`useQuery` ay **hindi nagbabago** — kaya low-risk.
- **Cache keys:** magkaiba ang key ng student at instructor (`["instructor","classes",id,"announcements"]` vs student). Dahil `switchUser` ay nagpapurge ng query cache, ayos para sa role switch. Pero kung mag-test ka na mabilis (walang switch) sa dalawang device/screen, magdagdag ng `mockDb.subscribe()` na nag-iinvalidate ng lahat ng key na apektado ng table. (Hindi kailangan kung switch-test lang.)
- **Remote transition:** pag naka-Supabase na, ang bawat `*-repository.ts` ay papalitan ng remote implementation (`DATA_SOURCE`); ang mock-db ay mananatili para sa offline demo/test. Isang switch lang sa `core/config/data-source.ts` (nasa codebase na) — ilapat ito sa mga domain repos para hindi mag-mix ng mock at remote (ngayon, auth lang ang gumagalang sa switch; ang ibang repos ay laging mock, kaya ang header mo ay "Justine Antipado" (remote) pero ang classes ay mock Maria — kaya magulo ang test).

### A.7 Panganib / dapat tandaan
- **Laki:** mga ~400–600 linya ang mock-db + seed; hatiin (`mock-db/{users,classes,content,assessments,notifications}.ts`) para sa 250-line rule ng UI-BRIEF.
- **Mutation ordering/identity:** gumamit ng iisang `newId` at timestamp na galing sa `mockNow()` para pare-pareho.
- **Huwag i-persist** sa AsyncStorage (hindi hiniling at may panganib na maiwan ang lumang shape); optional na lang kung gusto mong mabuhay ang data sa reload.
- **Huwag ihalo** sa totoong auth session — ang mock identities ay para sa `DATA_SOURCE=mock` lang.

---

## B. Karagdagang rekomendasyon (bagong audit, bukod sa seksyon 1–3)

### B.1 Pagiging tama ng data / derived values
| Isyu | Saan | Ayos |
|---|---|---|
| `studentCount`, `progress`, `submittedCount`, `pendingCount` ay static | `instructor/data/{class-directory,students-repository}.ts`, `student/data/classes-repository.ts` (`PROGRESS`) | Kompyutin mula sa tables (A.1) |
| Student `leave()` / instructor `remove()` / `joinByCode()` ay hindi magkaugnay | dalawang repo | iisang `enrollments` |
| `Home → Continue Learning` ay base sa fake `progress` | `student/home-screen.tsx` | derived progress = natapos na lessons/tasks ÷ kabuuan |
| Instructor `Submission` ay walang `studentId`/`classId` (pangalan lang) | `types/instructor.ts` | Dagdagan ng ids; huwag mag-join sa pangalan |
| Hindi pwede ang dalawang class na parehong `code` sa gradebook (1.14) | gradebook | gamitin `classId` |
| `joinCode` ay nakikita ng student (field `joinCode` sa `StudentClass`) | `student/data/classes-repository.ts` | Hindi dapat ibigay ang join code sa student (security); alisin sa student type |

### B.2 Mga lugar na tahimik na pumapalpak (error handling)
- Maraming `void mutation.run(...)` na walang toast sa failure: planner (regenerate, mark-done, move), student `deleteComment`, notifications mark-read (optimistic rollback pero walang mensahe), todo `toggle`. Gumawa ng iisang helper `useRunWithToast(mutation, {success, fail})` at gamitin kahit saan — mawawala ang pagkakaiba ng instructor (may toast) at student (wala).
- `submitExam` (planner): walang `else` kapag `!result.ok`.
- `useMutation` ay walang double-tap guard (3.6) — pinaka-importante para sa "Turn in", "Post", "Publish" (puwedeng magkaroon ng dobleng quiz).
- Ang `ErrorBoundary` ay nasa bawat Screen (maganda) pero ang `reportError` ay console lang; ayos na sa ngayon.

### B.3 Forms at UX
- **Draft autosave** ay may hook (`use-draft-autosave.ts`) pero walang gumagamit: ikabit sa create assignment/quiz/announcement (mahaba ang tina-type ng instructor; mawawala kapag natawagan o natakpan ng keyboard/crash).
- **Unsaved-changes guard**: meron sa create assignment, assignment-detail (student), quiz-take; **wala** sa create-quiz, ai-quiz, post-announcement (may), upload-material, create-class. Pantayin sa isang `useUnsavedGuard(dirty)`.
- **`create-quiz` ay may "Save draft"/"Publish" na parehong may `loading` = dalawang button na sabay umiikot** (iisang `createQuiz.loading`). Ihiwalay kung alin ang nag-trigger.
- **Class chips** (create-quiz, ai-quiz) ay tahimik na tumatanggap ng `classId = null` hanggang Publish (mensahe lang sa dulo). Piliin ang unang class by default o ipakita ang required marker.
- **Numeric fields** (`Points`, score) ay tumatanggap ng `decimal-pad` na may koma/dot lang sa ilan (`parseScore` ay nagko-convert ng koma, pero ang `validatePoints` ay hindi) — pantayin.
- **Empty states** sa Home (student) ay wala kapag walang tasks at walang classes (blangkong pahina). Magdagdag ng "Join a class" CTA.
- **Pull-to-refresh** ay nasa ilang screen lang (home, notifications, lists); wala sa course/class detail tabs.
- **Search** (`student/search`, `instructor/search`): hindi ko ni-verify ang debounce; tiyaking may debounce at hindi nagfi-filter sa bawat keystroke kapag remote na.

### B.4 Navigation / routing
- Ang `docs/ROUTE-MAP.md` ay hindi pa kasama ang mga bagong route (account subpages, notification detail, assignment edit, submissions, quiz edit). I-update kasabay ng bawat route.
- Pagkatapos mag-create (assignment/quiz/material/announcement), `router.replace` papuntang class detail — pero ang **tab** (`Assessments`/`Materials`) ay hindi nakatakda, kaya babalik sa **Stream**. Ipasa ang `tab` param (mayroon nang `useRouteEnum("tab")`) para mapunta sa tamang tab.
- Student "course-detail" `onLeft` ay `router.replace("/student/courses")` — tama; ang instructor ay walang katumbas na archive/delete class UI (dead hooks, 3.5).
- Back behavior: `backBehavior="history"` sa tabs + `useSafeBack` fallback — mukhang maayos; subukan ang deep link (`studiamobile://student/assignment-detail?...`) dahil ang route params ay validated pero walang "not found" screen para sa mismatched `classId/id` pair (ListState empty lang).

### B.5 Performance
- Maraming detail screens ay `ScrollView` + `.map()` (comments, questions, submissions). Sa remote na may daan-daang student/submission, gamitin ang `AppList` (virtualized) — lalo na ang **Submissions list (#12)** at **Gradebook**; planuhin na ngayon para hindi ma-rewrite.
- `useAllSubmissions()` (instructor) ay kumukuha ng **lahat** ng submissions ng lahat ng class para sa Home stats, Grading, Gradebook, at GradesTab → palitan ng `listByClass`/`listPending` na may pagination sa remote.
- `tasks-repository.list()` ay N+1 (bawat class: assignments + quizzes) at tinatawag din sa `toggleDone` at sa planner generate. Ang remote ay dapat isang endpoint (`GET /student/tasks`); sa mock, ayusin na kasama ng mock-db (isang pass).
- `Screen` ay nagre-render ng `AppHeader` na may dalawang `require` image; ok. Ang `AppImage` cache ay mayroon. Walang napansing problema.

### B.6 Accessibility at i18n
- Mga `Pressable` na walang `accessibilityRole`/label: suggestion chips (AI), transcript lines, ilang icon button. Dynamic type: tiyaking `numberOfLines` truncation ay hindi nagtatago ng kritikal na impormasyon (due date) — ang `ListRow` ay 2 linya max.
- Kulay lamang ang nagpapahiwatig ng estado (overdue = pula, badge tones) — may text naman ("Overdue · was due") kaya okay; i-check contrast ng `C.muted` sa `C.lavenderSoft`.
- Lahat ng teksto ay English (hardcoded). Kung hindi plano ang Filipino, okay; kung oo, mag-set na ng `strings.ts` bago lumaki pa.

### B.7 Testing at tooling
- **Walang test runner** (nakasaad sa CLAUDE.md). Dahil malaking bahagi ng bug ay *purong logic* (petsa, late rule, score parsing, filter, derived counts), magdagdag ng **`jest-expo`** (`npx expo install jest-expo jest @types/jest`) at magsimula sa: `shared/utils/format` (timezone), planner `generateBlocks`/week window, assignment late rule (`attach`/`turnIn`), `parseScore`, task `matches`, gradebook filter, auth validation. Kapag may `mockNow()` at mock-db, madaling i-test ang late/closed/overdue.
- Gumawa ng **CI script** (`npm run check` = `expo lint && tsc --noEmit && jest`) — sa ngayon manu-mano lang ang lint/tsc (CLAUDE.md).
- `expo-doctor` ay hindi pa napatakbo sa audit na ito; patakbuhin bago magdagdag ng mga native dependency (datetimepicker, keyboard-controller, image-picker) para makita ang compatibility sa SDK 58.
- **Dev build:** lahat ng bagong native dependency ay nangangailangan ng bagong dev client build (`eas build --profile development`) — isahang build sa halip na paulit-ulit; planuhin ang listahan ng native deps bago mag-build.

### B.8 Seguridad (para sa mock → remote)
- Ang `joinCode` sa student type (B.1) at ang `devCode` sa OTP (nandiyan ang `__DEV__` gate; i-verify na hindi napupunta sa production bundle).
- Rate limiting sa `joinByCode` (brute force 6-char code) — server-side; ilagay sa `api-contract.md`.
- Ang mock "AI" ay hindi dapat mag-ship nang hindi minarkahang *Preview*; ang AI endpoint ay dapat may per-user quota (gastos) at huwag magpadala ng PII sa AI provider.
- Link ng video / profile photo: tingnan 1.13 at 3.8.

### B.9 Mga bagong dokumentasyon na dapat sabay-update
`docs/api-contract.md` (instructor comment, assignment `closes_at`, submissions endpoints, quiz schedule/late, profile OTP purpose, video link, 50 MB, gmail-only), `docs/database.md` + bagong migrations, `docs/ROUTE-MAP.md`, README ng bawat folder na ginalaw (UI-BRIEF rule).

---

## C. Na-update na rekomendasyon sa pagkakasunod

Idagdag ang **Hakbang 0** bago ang Batch C ng seksyon 4:

0. **Mock-db unification** (A.6 hakbang 1–2: classes + enrollments, mock identity, `mockNow`) — ito ang nagpapahintulot ng makabuluhang testing ng #4, #5, #11, #12, #14.
   Pagkatapos ay gawin ang bawat feature **kasabay** ng paglipat ng domain nito sa mock-db (hindi hiwalay na malaking refactor).

**Dagdag na desisyon na kailangan ko:**
11. Mock identity: laging DEMO (Juan/Maria) o gamitin ang pangalan ng naka-login na user?
12. Gusto mo bang **DEV tools panel** (reset data, simulate time, failure rate) sa Account?
13. Papasok ba ang `jest-expo` + `npm run check` bilang bahagi ng gawain, o saka na?
14. Payag ka bang gawing **derived** ang lahat ng bilang (studentCount/progress/pending) kahit mag-iba ang lumalabas na numbers sa demo?
