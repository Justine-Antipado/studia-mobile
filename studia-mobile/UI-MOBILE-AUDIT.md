# UI-MOBILE-AUDIT — status ng `UI-FIXED-AND-LOGIC.md` sa `studia-mobile` (student + instructor)

> **Audit only. Walang code na binago.** Petsa: 2026-11-22.
> Paraan: code inspection (grep/basa ng file). **Hindi ako nag-test sa device/emulator**, kaya "✅" = nasa code na ang pagbabago, hindi garantiyang gumagana sa Oppo/Samsung/iPhone.
> `npx tsc --noEmit` at `npx expo lint`: **walang error** na lumabas.

## 0. Sagot: "nagawa na ba lahat?"

**Halos lahat ng feature ay nagawa na (13 sa 15 hiniling).** Ang natitira ay (a) keyboard fix na hindi pa napapatunayan / iba ang approach, at (b) ilang cross-cutting at cleanup item.

| # | Hiniling | Status | Ebidensya |
|---|---|---|---|
| 1 | Placeholder `you@gmail.com` | ✅ | `auth-screen.tsx:596` |
| 2 | Notification detail bago mark-read | ✅ | `notifications-screen.tsx` — `BottomSheet` detail; mark-read nasa pagbukas ng detail; `body` na sa type; badge ay `unread \|\| undefined` na (hindi na hardcoded `2`) |
| 3 | Account subpages (+OTP, photo) | ✅ | May `account-personal/password/privacy/about/photo` routes sa student at instructor; `expo-image-picker` nasa deps; migration `…013_otp_profile_update`, `…015_user_avatars` |
| 4 | Instructor comment sa announcement | ✅ | `addComment` sa instructor repo + hook; shared `comment-composer.tsx` |
| 5 | Assignment custom due, edit, late dropdown | ✅ | `date-time-field.tsx`, `select-field.tsx`, `assignment-form.tsx`, route `edit-assignment`; `@react-native-community/datetimepicker` nasa deps |
| 6 | Keyboard natatakpan (Android) | ⚠️ **Hindi tiyak** | Tingnan 1.1 |
| 7 | Header chips overflow/margin | ✅ | `segmented-tabs.tsx` — wala nang `marginHorizontal` |
| 8 | Tanggalin greeting, tab titles | ✅ | `PageTitle` na: Home, Courses, Classes, Assessments, Account; walang "Good day/Welcome back" (maliban sa auth card) |
| 9 | To-do filter sa baba | ✅ | `todo-screen.tsx` — "Filter & sort" `BottomSheet`; `logic/task-filters.ts` |
| 10 | Planner / Regenerate | ✅ | `toLocalIso` helper (`format.ts:59`), walang `toISOString().slice` na natira; toast sa success/fail; exam → "Revision blocks were scheduled" |
| 11/15 | Quiz due/late/close/edit/# questions | ✅ | `QuizDraft` may `dueAt/allowLate/closesAt/timeLimitMin`; `update()` sa quizzes repo; `edit-quiz` route; `quiz-form.tsx`; migration `…011_assessment_schedule` |
| 12 | Instructor submissions + grade per assignment | ✅ | `assignment-submissions(-repository).ts(x)`, route `grade-assignment` |
| 13 | Video = link, 50 MB cap | ✅ | `video-link.ts`, `video-link-card.tsx`, "Paste link / Upload" mode; `maxBytes: 50 * 1024 * 1024`; migrations `…012_material_cap_50mb`, `…014_material_video_links`; wala na ang hardcoded BigBuckBunny |
| 14 | Gradebook filter | ✅ | `GradeEntry`, `classId`-based, "Show: All / item" sheet, overall + per-item |
| E / Add.3 | Dobleng navigation (multi-back) | ✅ | `getId` sa lahat ng Stack.Screen (`_layout.tsx`); `use-safe-router.ts` (global nav-lock, unlock sa refocus, 1.8 s safety); 27 file ang gumagamit |
| 3.1 / A | Iisang mock database | ✅ | `core/data/mock/mock-db.ts`; student at instructor repos ay gumagamit na; magkapareho na ang sections (BSIT 3-A / 4-A) |
| 3.6 | Single-flight sa `useMutation` | ✅ | `use-mutation.ts` — `inFlight` map |
| 3.7 | "Switch view" demo leak | ✅ | naka-`__DEV__` na (`account-screen.tsx:107–117`) |

---

## 1. Mga hindi pa tapos / dapat i-verify

### 1.1 ⚠️ Keyboard (#6) — nagbago ang approach, hindi pa napapatunayan
- **Ginawa:** `Screen` at `BottomSheet` ay `KeyboardAvoidingView behavior="padding"` na ngayon sa **parehong platform** (dati `undefined` sa Android); inalis ang manual `kbPad` sa AI screen (may komento na nagpapaliwanag).
- **Hindi ginawa:** hindi sinunod ang inirekomendang `react-native-keyboard-controller` (wala sa `package.json`), at walang `android.softwareKeyboardLayoutMode` sa `app.json`.
- **Panganib:** ang RN `KeyboardAvoidingView` sa Android edge-to-edge ay **minsan** gumagana, minsan hindi (device-skin dependent — ang mismong sanhi ng orihinal na bug). Walang paraan para malaman sa code lang.
- **Gawin:** i-test sa Oppo/Realme (ColorOS) na may AI chat, "Add exam" sheet, auth forms, grade feedback. Kung natatakpan pa rin → `npx expo install react-native-keyboard-controller` (dev build).
- Maliit na kaugnay: `ai-chat-composer.tsx` — i-verify na wala nang `onSubmitEditing`/`returnKeyType` na conflict sa `multiline` (hindi lumabas sa grep, kaya malamang OK).

### 1.2 ❌ Time zone (3.4) — hindi pa
- `shared/utils/*.ts` ay walang `timeZone: "Asia/Manila"` (grep: wala). Ang display ng due dates ay sumusunod pa rin sa zone ng device.
- Walang `mockNow()` / "simulate time" (Addendum A.4) kaya ang `Date.now()` pa rin ang gamit sa overdue/late rules.

### 1.3 ❌ DEV tools panel (Addendum A.4) — hindi pa
- Walang `resetMockDb()`, simulate time, o runtime failure-rate. `MOCK_FAILURE_RATE = 0` ay hardcoded `const` pa rin (`mock-latency.ts:6`).
- Desisyon #12 sa orihinal na doc ay hindi ko alam kung na-approve; kung oo, hindi pa ito nagagawa.

### 1.4 ❌ Draft autosave at unsaved-changes guard (B.3) — hindi pa
- `use-draft-autosave.ts` ay **wala pa ring gumagamit**; walang `useUnsavedGuard` na nakita. Walang autosave sa create assignment/quiz/announcement.

### 1.5 ❌ Testing tooling (B.7) — hindi pa
- Walang `jest-expo`, walang `npm run check` script (`package.json`). Pure-logic bugs (timezone, late rule, task filters, gradebook summary) ay walang test.

### 1.6 ⚠️ Mock vs remote (Addendum D)
- Domain repos ay lahat nasa `mock-db`; auth lang ang sumusunod sa `DATA_SOURCE=remote`. Kaya pagkahalo ng totoong Google/Supabase login at mock data (hal. "Justine Antipado" kasama ang class ni "Maria") ay **nandiyan pa rin** ayon sa disenyo. Walang nakita akong "Demo data" badge sa screens.
- Hindi ko na-verify kung naayos ang `onAuthenticated → setUser` na hindi kumukopya ng `course/year` (D, maliit na bug).

### 1.7 ⚠️ Student quiz late/close enforcement (11) — hindi ko na-verify
- Student `quizzes-repository.ts` ay nagma-map na ng `dueAt/allowLate` (lines 37–39), pero hindi ko binasa kung ang `submitAttempt` ay **nagre-reject/nagta-tag ng Late** at kung may `closesAt` check. Ang timer ay may mock `startedAt` map para hindi ma-reset ang oras (mock-only; server dapat ang may `started_at`).
- **Gawin:** buksan ang `submitAttempt` at i-test: lampas due + `allowLate=false`, lampas `closesAt`.

### 1.8 ⚠️ Maliliit na natitira
| Item | Detalye |
|---|---|
| Tab label vs title | Student tab label ay "Alerts" (`app/student/(tabs)/_layout.tsx:17`) pero ang page ay "Notifications" — hindi pa napag-isa (desisyon #10 sa orihinal na doc). |
| `joinCode` sa student | Student `classes-repository` ay gumagamit pa rin ng `joinCode` sa mock join (`:43`) — OK para sa mock; i-verify na hindi ito nasa `StudentClass` type na nakikita ng UI (B.1/B.8). |
| Lumang TODO | `auth-screen.tsx:1` (`TODO(refactor)`), `ai-assistant-screen.tsx:3` (AI via service layer), `mock-auth-service.ts` (backend TODOs) — kilala; hindi blocker. Hindi ko ni-check kung nalinis ang mga lumang "TODO persist accessToken" at stale TODO sa onboarding. |
| Dead code (3.5) | Hindi ko inulit ang export scan; `useDraftAutosave` ay confirmed na walang gumagamit. |
| Docs | May `docs/api-contract.md`, `ROUTE-MAP.md`, `database.md` pa rin; hindi ko na-verify kung na-update para sa bagong routes (edit-assignment, grade-assignment, account-*, edit-quiz) at endpoints. |
| Dark mode | `app.json` ay `"userInterfaceStyle": "automatic"` pa rin habang light-only ang `C` colors — hindi pa pinipili (§2 ng orihinal na doc). |

---

## 2. Mungkahing susunod na hakbang
1. **Device test** ng keyboard (1.1) — ito lang ang item na maaaring bumalik bilang bug sa user.
2. `timeZone: "Asia/Manila"` sa format helpers (1.2) — maliit na gawa, malaking epekto sa late/due display.
3. I-verify ang student quiz late/close (1.7).
4. Pagkatapos: autosave/unsaved guard (1.4), DEV tools (1.3), jest (1.5), docs update.

## 3. Hindi ko sinuri
Hindi ko binuksan ang bawat screen para sa visual/responsive na detalye (320 px, accessibility labels, touch targets), ang laman ng bawat migration, at ang runtime ng bawat flow. Kung gusto mo, patakbuhin ko ang app/ i-review ang partikular na screen.
