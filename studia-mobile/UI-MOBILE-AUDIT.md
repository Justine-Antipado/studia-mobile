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
| 5 | Assignment custom due, edit, late dropdown | ✅ | `date-time-field.tsx`, `select-field.tsx`, `assignment-form.tsx`, route `edit-assignment`; custom bottom-sheet picker na ngayon (wala nang `@react-native-community/datetimepicker`) |
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

## 1. Status ng dating "hindi pa tapos" (na-update pagkatapos ng implementation)

| Item | Status | Ginawa |
|---|---|---|
| Timezone (3.4) | ✅ | `TIME_ZONE = "Asia/Manila"` sa `shared/utils/format.ts` (`dueLabel`) at sa dalawang notification body ng instructor repos. *Hindi* ginalaw ang picker display (`date-time-field.tsx`): device-local ang native picker, kaya sa device na PH ang oras magkapareho; sa ibang zone mag-iiba. |
| `mockNow()` / simulate time (A.4) | ✅ | `core/data/mock/mock-clock.ts`; gamit na sa `isOverdue/timeAgo/dueLabel`, `submitWindow` (quiz), assignment late rule, notification "time ago", at "Today" ng To-do. DEV lang ang offset. |
| Failure rate (A.4) | ✅ | Runtime na (`setFailureRate`) at/o `EXPO_PUBLIC_MOCK_FAILURE`; wala nang hardcoded `const`. |
| DEV tools (A.4) | ✅ | `features/shared-screens/components/dev-tools.tsx` sa Account (`__DEV__`): +1 day, +1 week, Reset clock, Failure rate, Reset mock data (matagal nang may reset; ngayon kasama na ang clock). |
| Unsaved-changes guard (B.3) | ✅ | Shared `useUnsavedGuard` (`shared/hooks/use-unsaved-guard.tsx`); idinagdag sa `ai-quiz`, `upload-material`, `create-class`, at gamit ng `post-announcement`. (Mayroon na dati sa assignment-form, quiz-form, student assignment-detail.) |
| Draft autosave (B.3) | ✅ (isang screen) | `post-announcement` ay gumagamit na ng `useDraftAutosave` (per class; nabubura kapag na-post o na-discard). Hindi pa ikinakabit sa assignment/quiz form (mas malaki ang state). |
| Testing (B.7) | ✅ | `jest-expo` + 15 tests (format/timezone/overdue, assignment due rules, task filters, mock clock); scripts `npm test`, `npm run typecheck`, `npm run check` (= lint + tsc + jest). |
| "Demo data" badge (D) | ✅ | Pill sa `AppHeader`, kontrolado ng `DOMAIN_DATA_IS_MOCK` sa `core/config/data-source.ts` (i-flip sa `false` kapag remote na ang domain repos). |
| Dark mode | ✅ | `userInterfaceStyle: "light"` sa `app.json` (light-only ang `C` colors). Kailangan ng bagong native build/`expo start -c` para mag-apply. |
| Tab label vs title | ✅ (hindi pala problema) | Parehong "Alerts" ang tab label at page title; mali ang naunang audit. |
| Student quiz late/close | ✅ | Na-verify na (tingnan 1.7 sa dating bersyon: `submitWindow` check). |
| Docs | ✅ | `docs/ROUTE-MAP.md` at `docs/api-contract.md` ay may na ang bagong routes at endpoints (edit-assignment, grade-assignment, account-*, edit-quiz, instructor comments, profile OTP). |
| **Keyboard (#6)** | ⚠️ **Hindi ginalaw** | Device-dependent at ang inirekomendang `react-native-keyboard-controller` ay native module (hindi gagana sa Expo Go; kailangan ng dev build). Hindi ko ito idinagdag nang walang device test. Kung natatakpan pa rin sa Oppo/Realme → `npx expo install react-native-keyboard-controller` at palitan ang `KeyboardAvoidingView` sa `Screen` at `BottomSheet`. |

Natitirang maliit na pagkakaiba: ang `useDraftAutosave` ay hindi pa nasa assignment/quiz forms; ang picker ay device-local.

**Pagsusuri pagkatapos ng pagbabago:** `npx tsc --noEmit` ✅ · `npx expo lint` ✅ · `npx jest` ✅ (4 suites, 15 tests).

---

## 2. Mungkahing susunod na hakbang
1. **Device test** ng keyboard (1.1) — ito lang ang item na maaaring bumalik bilang bug sa user.
2. `timeZone: "Asia/Manila"` sa format helpers (1.2) — maliit na gawa, malaking epekto sa late/due display.
3. I-verify ang student quiz late/close (1.7).
4. Pagkatapos: autosave/unsaved guard (1.4), DEV tools (1.3), jest (1.5), docs update.

## 3. Hindi ko sinuri
Hindi ko binuksan ang bawat screen para sa visual/responsive na detalye (320 px, accessibility labels, touch targets), ang laman ng bawat migration, at ang runtime ng bawat flow. Kung gusto mo, patakbuhin ko ang app/ i-review ang partikular na screen.
