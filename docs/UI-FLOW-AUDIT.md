# Studia Mobile: UI Flow Audit

**Petsa:** 2026-11-27
**Saklaw:** `studia-mobile`, student at instructor
**Paraan:** pagbasa ng code. Hindi pinatakbo ang app, at walang binagong code.

## Prinsipyo

Ang **daloy** ng Google Classroom (GClass) ang basehan, **hindi ang itsura nito**.

- **Mananatili:** kulay, font, logo at mascot, cards, bottom tab bar, Home tab, Account tab, AI features, at ang shared components sa `shared/components/ui`.
- **Hihiramin sa GClass:** iisang daan papunta sa bawat gawain, classwork na nasa iisang listahan, at malinaw na status mula assign hanggang return.

Ang mga pangalang gaya ng "Classwork", "To review" at "Return" ay mungkahi lang. Puwedeng palitan ng sariling termino ng Studia.

## 1. Mga bug sa flow

| # | Problema | File |
|---|---|---|
| 1 | Nawawala ang na-archive na class. `archived=false` lang ang nililista, at nasa loob ng class ang "Unarchive", kaya hindi na ito mababalikan. | [classes-remote.ts](../studia-mobile/src/features/instructor/data/classes-remote.ts) |
| 2 | Hindi kasama ang assignments sa "To Grade". Quiz attempts lang ang binibilang, kaya puwedeng "All caught up" kahit may assignment na hindi pa na-grade. | [use-stats.ts](../studia-mobile/src/features/instructor/hooks/use-stats.ts), [assessments-screen.tsx](../studia-mobile/src/features/instructor/screens/assessments-screen.tsx) |
| 3 | Nagsisimula agad ang quiz timer pag-tap mula sa Home, To-do o Tasks. Walang intro o "Start" button. | [quiz-take-screen.tsx](../studia-mobile/src/features/student/screens/quiz-take-screen.tsx) |
| 4 | "Result not found" kapag manual na tinick ang quiz na hindi pa sinagutan, tapos binuksan sa To-do. | [todo-screen.tsx](../studia-mobile/src/features/student/screens/todo-screen.tsx) |
| 5 | Pagka-save ng AI quiz, lalabas pa rin ang "Discard this quiz?". | [ai-quiz-screen.tsx](../studia-mobile/src/features/instructor/screens/ai-quiz-screen.tsx) |
| 6 | Hindi lumalabas sa To-do ang gawaing walang due date. | [tasks-remote.ts](../studia-mobile/src/features/student/data/tasks-remote.ts) |
| 7 | "Open" pa rin ang badge ng quiz na sarado na. | [tasks-tab.tsx](../studia-mobile/src/features/student/components/course-detail/tasks-tab.tsx) |
| 8 | Hindi dinadala ng notification ang user sa item. Bottom sheet lang ang bumubukas. Kailangan din ng IDs sa `link_params` (database migration). | [notifications-screen.tsx](../studia-mobile/src/features/shared-screens/screens/notifications-screen.tsx) |
| 9 | Sa Home, ang "Upcoming deadlines" ay sa To-do pumupunta, hindi sa mismong task. | [home-screen.tsx](../studia-mobile/src/features/student/screens/home-screen.tsx) |
| 10 | Sa Classes list lang makikita ang join code, wala sa loob ng class. | [class-detail-screen.tsx](../studia-mobile/src/features/instructor/screens/class-detail-screen.tsx) |

## 2. Dapat tanggalin

| Tanggalin | Dahilan |
|---|---|
| Quick actions na "My Courses", "My Classes", "AI Assistant" | May tab na para sa mga ito |
| Quick actions na "Create Quiz" at "AI Quiz" | Nasa Classwork na ng class ang paggawa |
| Magkahiwalay na "Today's tasks" at "Upcoming deadlines" sa Home | Pagsamahin sa isang maikling "Due soon" na diretso sa item |
| "Continue Learning" at 2-item na preview ng classes sa Home | Papalitan ng buong class list sa Home |
| Manual checkbox sa quiz | Dapat "done" lang kapag na-submit |
| Manual checkbox sa assignment na walang submission | "Done" sa student pero "Missing" sa instructor. Kung itatago, dapat makita rin ng instructor. |
| Instructor "Assess" tab | Papalitan ng "To review"; ang paggawa ay nasa loob ng class |
| Dobleng percentage sa instructor People tab | Nasa subtitle at nasa badge |

## 3. Dapat pagsamahin

| Ngayon | Gawing |
|---|---|
| Home + Courses (student), Home + Classes (instructor) | **Home** na may greeting, isang summary card, at buong class list |
| Student: Lessons + Tasks | **Classwork** |
| Instructor: Materials + Assessments | **Classwork**, may iisang **+ Create** (Material, Assignment, Quiz, AI Quiz) |
| "To Grade" tab + `grading` screen + Home "Needs grading" | **To review**, kasama na ang assignments |
| `grade-submission` + `grade-assignment` | Iisang grading screen, parehong may "next student" |
| `create-quiz` + `ai-quiz` | Iisang quiz form na may "Generate with AI". Ngayon, hindi ma-edit ang AI questions at walang due date picker. |
| Personal Information + Change Photo | Tap sa avatar para palitan ang photo |
| Privacy Policy + About | Isang **About** |
| Welcome + Learn More + Explore | Welcome at role choice; link na lang ang Learn More |

## 4. Target na flow

### Bottom tabs

| Role | Ngayon | Mungkahi |
|---|---|---|
| Student | Home · Courses · AI · Alerts · Account | Home · To-do · AI · Alerts · Account |
| Instructor | Home · Classes · Assess · AI · Alerts · Account | Home · To review · AI · Alerts · Account |

**Loob ng class:** Stream · Classwork · People, at Grades para sa instructor.

### Student

1. Home → Join class → code → class
2. Class → Classwork → item → detail (instructions, due date, points, "Your work")
3. Assignment: Add file → Turn in → Unsubmit kung may babaguhin
4. Quiz: detail → **Start** → sagot → result
5. To-do: **Assigned · Missing · Done**, kapalit ng limang filter ngayon
6. Ang grade ay makikita sa item mismo, kaya puwede nang alisin ang Grades tab ng student.

### Instructor

1. Home → Create class → class, kita agad ang join code
2. Classwork → + Create
3. Item → listahan ng students (Turned in · Assigned · Graded) → grade → **Return**. "Turn in" ang label ngayon, na pang-student.
4. Grades → tap student → lahat ng gawa niya. Ngayon, hindi natatap ang rows.

### Mga kulang na hakbang

- Edit ng class, announcement at material
- Listahan ng archived classes
- Topics para ayusin ang Classwork
- Private comments sa pagitan ng student at instructor

## 5. Mga kailangang pagdesisyunan

| Tanong | Mungkahi |
|---|---|
| Study Planner | Gawing view sa loob ng To-do |
| Analytics | Ilagay sa Grades ng bawat class, o iwang card sa instructor Home |
| Role choice bago mag-login | Sa registration na lang. Kailangang baguhin ang `studia-api` dahil ipinapadala ang `role` sa login. |

Kung bahagi ng thesis o requirements ang Planner at Analytics, ilipat lang, huwag tanggalin.

## 6. Pagkakasunod ng trabaho

1. Bugs 1–7, 9 at 10 (app lang ang gagalawin)
2. Classwork merge at iisang + Create
3. Home na may class list, at bagong tabs
4. To review at iisang grading screen
5. Notification deep links (may migration)

Sa bawat hakbang, i-update ang [ROUTE-MAP.md](ROUTE-MAP.md).

## 7. Hindi pa nasuri nang detalyado

- Mga form sa auth, password at profile
- File viewer
- Mga form ng announcement, material at assignment

Luma na rin ang ilang bahagi ng [ROUTE-MAP.md](ROUTE-MAP.md): may AI segments (Chat · Summarizer · Practice) at notification deep links doon na wala sa code.
