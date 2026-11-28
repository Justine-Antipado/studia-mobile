# Studia Mobile — Route Map

Approved at P0, updated at P5 (2026-11-19) to match the navigator that was actually built.
Update this file whenever routes are added.

## Navigator shape

Each role group is an **outer Stack whose first screen is a `(tabs)` group**, not one Tabs
navigator with hidden children:

```
app/_layout.tsx                    Stack (root): index · learn-more · explore · auth · student · instructor
app/student/_layout.tsx            Stack: (tabs) + every student sub page
app/student/(tabs)/_layout.tsx     Tabs: home · courses · todo · planner · ai
app/student/course-detail.tsx      a Stack screen, pushed over the tab bar
```

Account and Alerts (notifications) are not tabs: the header (`shared/components/ui/app-header.tsx`,
rendered by `Screen` on every page) opens them from the avatar and the bell icon, as ordinary pushed
sub pages. They sit in `SUBPAGE_ROUTES` like any other sub page, with `/<role>/home` as their back
fallback.

The first attempt registered sub pages inside the Tabs navigator with `href: null`. Navigating to
one of them fell back to the first tab — the URL flashed the sub page and then snapped back to
`/home` — so the group became tabs nested in a stack, which is also Expo's recommended pattern and
gives a real back stack. `(tabs)` is a group, so it adds no URL segment: `/student/home` and
`/student/course-detail` are both unchanged.

Consequences worth knowing:

- Sub pages cover the tab bar completely, so **no tab needs to stay highlighted on a child route**.
  The `also` mapping from the P0 plan no longer exists in `TabItem`; the tab bar highlights the
  active tab and nothing else.
- Each role group registers its sub pages explicitly in `app/<role>/_layout.tsx`, split into
  `SUBPAGE_ROUTES` (slide in from the right) and `MODAL_ROUTES` (presented as a sheet from the
  bottom). Adding a route file means adding its name to one of those two lists.

## Conventions

- Routes live in `studia-mobile/src/app/`; every route file is a thin re-export of a screen in
  `features/<feature>/screens/`.
- Transitions come from `core/config/transitions.ts`: `STACK_SUBPAGE` (`slide_from_right`),
  `MODAL_SHEET` (`presentation: "modal"` + `slide_from_bottom`), `TAB_SCREEN` (`fade`, plus
  `lazy` and `freezeOnBlur` so a tab is not rebuilt or refetched on every switch). All of them go
  through `useScreenAnimation()`, which drops to no animation when the OS reduce-motion setting
  is on.
- Every back button and the Android hardware back go through `useSafeBack(fallback)`, where the
  fallback is the logical parent in the tree below — never just home. On a deep link or cold start
  with no history it replaces with that parent, so a sub page can never dead-end.
- All `?params` are validated before use (`core/logic/route-params.ts`: `parseId`,
  `parseEnum`, `useRouteId`, `useRouteIds`, `useRouteEnum`). Route params are never
  trusted.
- Role guards: `/student/*` requires a student session and `/instructor/*` an instructor session
  (`RoleGate` + `useRoleGuard`); no session redirects to `/auth`, except the `__DEV__` demo-user
  fallback. This only hides UI — real authorization belongs on the backend.
- Both role layouts are wrapped in an `ErrorBoundary`, as is the root layout and every screen body
  (through the `Screen` component).

## Root

| Route | Screen | Back fallback |
|---|---|---|
| `/` | welcome | — |
| `/learn-more` | onboarding / learn more | `/` |
| `/explore` | role choice | `/` |
| `/auth?role=student\|instructor` | login · register · OTP · reset | `/explore` |

## Student — `/student/*`

Tabs: **home · courses · todo · planner · ai**. Account (avatar) and Alerts (bell) live in the
header, not the tab bar.

```
(tabs)
  home                                        tab
  courses                                     tab
  todo                                        tab
  planner                                     tab
  ai                                          tab   segments: Chat · Summarizer · Practice

Stack sub pages                                     back fallback
  account                                           → /student/home       (opened from the header avatar)
  notifications                                     → /student/home       (opened from the header bell; taps deep-link into the target screen)
  account-personal                                  → /student/account   (edit profile, email OTP before saving)
  account-password                                  → /student/account   (email OTP, then new password)
  account-privacy                                   → /student/account
  account-about                                     → /student/account
  account-photo                                     → /student/account   (camera / gallery / remove; cropped + resized on device)
  add-plan                            (modal)       → /student/planner    (add a plan or an exam date)
  join-class                          (modal)       → /student/courses
  course-detail?id&tab                              → /student/courses
      tabs: Stream · Lessons · Tasks · Grades · People  (tab kept in the URL)
  announcement-detail?classId&id                    → /student/course-detail
  lesson-viewer?classId&id                          → /student/course-detail
  assignment-detail?classId&id                      → /student/course-detail
  quiz-take?classId&quizId            (modal)       → /student/course-detail  (confirm-discard on exit)
  quiz-result?classId&quizId&attemptId              → /student/course-detail
```

Notes

- **No duplicate pushes:** every `Stack.Screen` has `getId` (`core/logic/screen-id.ts`), the route
  params, so a rapid double/triple tap opens one copy of a sub page and one Back returns. Opening a
  *different* item (other `id`) still stacks.
- Study Planner joined the tab bar (it was previously reached from the Home quick action only), so
  the tab bar is now five items: Home · Courses · To-do · Planner · AI.
- Leave class is a confirm dialog inside `course-detail` (People tab), not a route.
- The assignment late rule lives in `assignment-detail`: when late submissions are not allowed the
  picked file stays an attached draft and a "Turn in" button appears on reopen; when they are
  allowed, submitting shows a `Late` badge. The server decides which applies
  (`docs/api-contract.md`).

## Instructor — `/instructor/*`

Tabs: **home · classes · assessments · ai**. Account (avatar) and Alerts (bell) live in the header,
not the tab bar.

```
(tabs)
  home (analytics overview)                   tab
  classes                                     tab
  assessments                                 tab   segments: Quizzes · To Grade
  ai                                          tab

Stack sub pages                                     back fallback
  account                                           → /instructor/home   (opened from the header avatar)
  notifications                                     → /instructor/home   (opened from the header bell)
  account-personal / account-password / account-privacy / account-about
                                                    → /instructor/account (same screens as the student group)
  analytics                                         → /instructor/home
  create-class                        (modal)       → /instructor/classes
  class-detail?id&tab                               → /instructor/classes
      tabs: Stream · Materials · Assessments · People · Grades  (tab kept in the URL)
      Grades: every enrolled student's overall %, alphabetical by name (replaces the old standalone Gradebook screen)
  post-announcement?classId           (modal)       → /instructor/class-detail  (confirm-discard)
  announcement-detail?classId&id                    → /instructor/class-detail  (moderate comments)
  upload-material?classId             (modal)       → /instructor/class-detail  (video link OR .pdf .ppt(x) .doc(x) up to 50 MB)
  material-detail?classId&id                        → /instructor/class-detail  (video link card, transcript + paste-transcript fallback, objectives, delete)
  create-assignment?classId           (modal)       → /instructor/class-detail  (date/time picker, points, late dropdown, attachments)
  edit-assignment?classId&id          (modal)       → /instructor/assignment-detail  (same form, preloaded incl. attachments)
  assignment-detail?classId&id                      → /instructor/class-detail  (+ Submissions: Submitted/Late/Missing/Graded)
  grade-assignment?classId&assignmentId&studentId   → /instructor/assignment-detail
  student-detail?classId&studentId                  → /instructor/class-detail  (progress, remove student)
  create-quiz                         (modal)       → /instructor/assessments   (MC · Identification · Essay, schedule & rules, confirm-discard)
  edit-quiz?id                        (modal)       → /instructor/quiz-detail   (same form; questions locked once students have submitted)
  ai-quiz                             (modal)       → /instructor/assessments   (MC only; count, difficulty, Bloom)
  quiz-detail?id                                    → /instructor/assessments   (Draft / Published)
  grading?quizId                                    → /instructor/assessments
  grade-submission?id                               → /instructor/grading
```

Archive / delete class and delete material are confirm dialogs, not routes.

## Shared screens

`ai`, `notifications` and `account` are one implementation each, role-aware through a `role` prop
(`features/shared-screens/screens/`). Each role group keeps its own thin route file pointing at the
same screen, because the two groups are separate navigators.

## Not built yet

Planned in the P0 map, still missing. Routes do not exist, and the Account list shows placeholder
rows for the settings ones:

- Account sub-pages: `notification-settings`, `appearance`, `language`, `privacy-security`
  (sessions, sign out all, Clear cache) and `help`. `account-personal`, `account-password`,
  `account-privacy`, `account-about` and `account-photo` exist (see above).
- Student AI sub-pages: `ai-summary?sourceId`, `ai-mind-map?sourceId`, `ai-flashcards?sourceId`.

When they are added: put the file in `app/<role>/`, add its name to `SUBPAGE_ROUTES` (or
`MODAL_ROUTES`) in that group's `_layout.tsx`, give the screen a `useSafeBack("/<role>/account")`
fallback, and add the row to the table above.
