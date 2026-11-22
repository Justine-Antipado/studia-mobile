# UI-ADMIN-AUDIT — studia-admin laban sa `UI-FIXED-AND-LOGIC.md`

> **Audit only. Walang code na binago.** Ang file na ito lang ang idinagdag.
> Petsa: 2026-11-22 · Saklaw: `studia-admin/src` (Vite + React 19 + React Router 7) · `npm run lint` (oxlint): **malinis**.

## 0. Sagot sa tanong: "nagawa na ba lahat?"

**Hindi — pero hindi rin kailangang gawin lahat sa admin.** Ang `UI-FIXED-AND-LOGIC.md` ay audit ng **`studia-mobile`** (student + instructor). Ang admin ay ibang app: web, isang role, at "read + delete lang" (announcements lang ang may create). Kaya sa 15 hiniling na item + addenda:

| Kategorya | Bilang | Ibig sabihin |
|---|---|---|
| **N/A sa admin** (walang katumbas na feature) | 10 | #4, #5, #6, #9, #10, #11, #12, #13, #14, #15 |
| **Meron na at maayos** | 4 | #7 (tab overflow), #8 (page title/walang greeting), accessibility, mock/demo labeling |
| **Naaangkop pero HINDI pa nagagawa** | 6 | #2 notification detail, #3 account (profile edit/OTP hygiene), debounce+history ng search, double-submit guard, timezone, stale nav badge |

Paalala sa saklaw ng pagsusuri: binasa ko nang buo ang `Layout`, `Tabs`, `ui.jsx` (Modal/Toast/Card), `ConfirmDialog`, `Topbar`, `useAsync/useMutation`, `useQueryState`, `format.js`, `api.js`, `Login`, `Notifications`, `Announcements` + `CreateAnnouncementModal`, `Account`, `EmailOtp`, bahagi ng `Users`, at ang responsive/tabs CSS. **Hindi ko binuksan nang buo**: `Dashboard`, `Classes`/`ClassDetail`, `Content`, `Reports`, `AiHealth`, `Sessions`/`AuditLog` UI, `Sidebar` — kaya ang mga hatol sa ibaba ay para sa mga file na nabasa ko. Hindi ko rin pinatakbo ang app sa browser/`npm run build`.

---

## 1. Item-by-item mapping

| # sa mobile doc | Paksa | Status sa admin | Detalye |
|---|---|---|---|
| 1 | Gmail placeholder | **N/A** | Fixed admin account ito; `Login.jsx:127` ay `admin@omsu.edu.ph` (placeholder lang, tama para sa admin). Hindi sakop ng gmail-only rule (new accounts lang). |
| 2 | Notification detail bago mark-as-read | **❌ Hindi pa** | Tingnan A1 |
| 3 | Account subpages + OTP-protected edit | **⚠️ Bahagya** | Password-change na may OTP ✅. Walang profile edit, may mga bug sa OTP step. Tingnan A2 |
| 4 | Announcement comments | **N/A** | Walang comments sa admin announcements. |
| 5 | Due date / late / edit assignment | **N/A** | Pero tingnan A7 para sa *scheduled announcement* (pinakamalapit na katumbas). |
| 6 | Keyboard natatakpan (Android) | **N/A** | Web; walang native keyboard issue. Modal ay may focus trap ✅. |
| 7 | Header tabs overflow/margin | **✅ OK** | `.tabs` ay `flex-wrap: wrap` (`index.css:388`), walang negatibong margin, walang clip. Hindi na-replicate ang mobile bug. |
| 8 | Alisin greeting, lagyan ng page title | **✅ Tapos** | Walang "Welcome/Good day" sa loob ng app (tanging login card "Welcome back"). Bawat page ay may `PageHeader` na may iisang `<h1>`. Maliit na puna: A8 (duplicate title). |
| 9 | To-do sort/filter overlap | **N/A** | |
| 10 | Study Planner | **N/A** | Pero ang *timezone root cause* ay naaangkop — A5. |
| 11–15 | Quiz/assignment schedule, submissions view, video link, gradebook | **N/A** | Read-only ang admin sa academics ("Users, classes, content and assessments are read and delete only" — `Help.jsx:9`). |
| 3.1 / A–A.7 | Magkahiwalay na mock stores | **N/A** | Isang `mockBackend.js` + `mockData.js` lang; iisang source. |
| 3.4 | Time zone | **❌ Hindi pa** | A5 |
| 3.5 | Dead code | **⚠️** | A6 |
| 3.6 | Walang double-submit guard sa `useMutation` | **❌ Hindi pa** | A4 |
| 3.7 / D | Mock vs remote, demo leak | **✅ Maayos** (may isang bug) | B2 |
| E | Dobleng navigation / maraming back | **⚠️ Iba ang anyo** | A3 (search = history spam) |
| 1.8/§2 | Dark mode consistency | **✅ Consistent** | Light-only; walang `prefers-color-scheme`, walang kalahating dark. |
| §2 | Accessibility | **✅ Malakas** | B1 |

---

## 2. Mga isyung hindi pa nagagawa (naaangkop sa admin)

### A1. Notifications: walang detail view; stale na badge  — katumbas ng mobile #2
- **File:** `features/notifications/pages/Notifications.jsx`
- **Nakita:**
  - Ang `message` ay `truncate(n.message, 90)` (line 99) at **walang paraan para mabasa ang buong mensahe** — walang detail, walang expand, walang link papunta sa pinagmulan (failed job, storage warning, security alert). Para sa admin, ang buong teksto ng alert ang mismong kailangan.
  - Mark-read ay hiwalay na "Mark read/unread" link (line 157) — ito ay **mas ligtas** kaysa sa mobile (hindi auto-mark sa tap), kaya hindi bug; pero walang view na nagpapakita ng detail *bago* mag-decide.
  - **Stale badge:** `Layout.jsx:45` → `useAsync(... getNavCounts ..., [])` ay tumatakbo **isang beses lang** (empty deps). Pagkatapos mag-mark-read/mark-all-read, ang sidebar badge at ang dot sa Topbar bell (`Topbar.jsx:41`) ay **hindi bumababa hanggang mag-reload ang buong page**. Inaamin ito ng header comment ng `Notifications.jsx` ("after the next sidebar refresh") pero walang mekanismo ng refresh. Ito ang katumbas ng "hardcoded badge: 2" na natukoy sa mobile.
- **Dapat gawin:** (1) expandable row o `Modal`/side panel na may buong `message`, `type`, oras (buong petsa), at "Open" link kung may target; (2) pagkatapos ng `toggleRead`/`markAllRead`, i-refresh ang nav counts (halimbawa: maliit na `NavCountsContext` na may `refresh()`, o i-lift ang `useAsync` ng counts at ipasa ang `reloadCounts` sa pamamagitan ng `Outlet context`); (3) optional: i-optimistic-update ang `unread` count para instant.

### A2. Account page — profile edit at kalidad ng OTP flow  — katumbas ng mobile #3
- **File:** `features/settings/pages/Account.jsx`
- **Nakita:**
  1. **Profile ay read-only.** Ang subtitle ay "Profile and password change with OTP" (line 121) pero walang paraan para baguhin ang pangalan/email — pangalan at email lang ang ipinapakita. Kung sinadya (fixed admin), baguhin ang subtitle para hindi nakaliligaw; kung hindi, idagdag ang edit na OTP-protected gaya ng gusto sa mobile (3.8 doc: OTP single-use, tie sa purpose `profile_update`).
  2. **`devCode` ay laging nasa toast, walang gate** (line 66): `` `OTP sent to ${r.sentTo} (dev: ${r.devCode})` ``. Sa HTTP backend (`httpBackend.js:73`) ang `devCode` ay malamang wala → lalabas ang literal na **"(dev: undefined)"**, at kung sakaling magbalik ang server ng code sa production, **mailalantad ang OTP sa screen**. Ilagay sa likod ng `isMockBackend`/`import.meta.env.DEV`, at itago ang "(dev: …)" kapag walang code.
  3. **Walang "Current password"** na hinihingi bago magpalit (OTP lang). Katanggap-tanggap kung OTP ang sentral na proteksyon, pero ihambing sa mobile doc 1.3 ("Current → OTP → new").
  4. **OTP boxes:** walang paste-handling (`onChange` ay `slice(-1)` — ang pag-paste ng 6-digit code ay iisang digit lang ang papasok), walang `autoComplete="one-time-code"`. Ang `verify()` ay awtomatikong tumatakbo kapag puno na (line 91) at **walang guard laban sa dobleng verify** (mabilis na pag-edit ng huling digit ay magpapadala ng ikalawang request) at walang error-reset ng mga digit kapag mali ang code (mananatili ang maling digits, naka-disable lang pagkatapos ng `verified`).
  5. Password fields ay walang `autoComplete="new-password"` (password manager ay maaaring mag-fill ng lumang password).
  6. Ang `cooldown` ay `0:${String(cooldown).padStart(2,'0')}` — mali kapag `resendSeconds` ≥ 60 (hal. 90 → `0:90`; dapat gamitin ang `formatCountdown` na umiiral na sa `format.js`).
- **Dapat gawin:** ayusin ang 2 (priority), 6 (isang linya), 4 (paste + clear on fail), at magpasya sa 1.

### A3. Search box = bagong history entry bawat keystroke, at walang debounce  — katumbas ng mobile "E" (maraming back)
- **Mga file:** `Announcements.jsx:138`, `Classes.jsx:117`, `Content.jsx:119`, `UserFilters.jsx:22`, `AuditLog.jsx:84`, `LoginAttempts.jsx:70`; sanhi sa `shared/hooks/useQueryState.js:36–55`.
- **Root cause:** `setQuery({ q })` ay tumatawag ng `setSearchParams(..., { replace })` na **`replace = false` bilang default** → bawat titik na tinipa ay **bagong entry sa browser history** *at* bagong request (ang `params` ay nagbabago → `useAsync` ay nag-aabort at nagre-refetch bawat keystroke).
- **Epekto:** mag-type ng "mathematics" (11 titik) → 11 pindot ng Back bago makaalis sa page. Ito ang web na bersyon ng "tatlong tap = tatlong back" na bug sa mobile. Sa totoong HTTP backend, ito rin ay request spam.
- **Dapat gawin:** (1) sa `useQueryState`, gamitin ang `replace: true` para sa mga *text* key (`q`) — o i-default ang `replace` kapag walang pagbabago sa `page`/`tab`; (2) i-debounce ang `q` (ang `useDebounce` at `useDebouncedCallback` ay **umiiral na sa `shared/hooks/useDebounce.js` pero walang gumagamit** — tingnan A6): panatilihin ang local input state at i-commit sa URL pagkalipas ng ~300 ms.

### A4. `useMutation` ay walang single-flight guard — katumbas ng mobile 3.6
- **File:** `shared/hooks/useAsync.js:73–90`
- `mutate` ay nagse-set ng `pending` pero **hindi nito tinitingnan** kung may tumatakbo na. Ang proteksyon ay nasa UI lang (`disabled={pending}`) — mag-a-apply lang iyon pagkatapos mag-re-render, kaya ang napakabilis na double-click (o Enter key-repeat sa form) ay maaaring makapasok ng dalawang request.
- **Nakakaapekto:** `CreateAnnouncementModal` (`Post now` → dobleng announcement), `useSettings.save`, at ang mga pahinang gumagamit ng sarili nilang `busy` state (`Users.runDelete`, `Announcements.runDelete`, `Notifications.toggleRead/markAllRead` — pareho ang puwang: ang `setBusy(true)` ay hindi agad nababasa ng ikalawang click sa parehong tick).
- **Dapat gawin:** `const inFlight = useRef(false); if (inFlight.current) return;` sa `mutate` (at sa mga pahinang may sariling `busy`, gamitin ang `useMutation` imbes). Mababa ang gastos, mataas ang halaga para sa "Post announcement" at "Delete permanently".

### A5. Time zone ay hindi naka-lock — katumbas ng mobile 3.4
- **File:** `core/logic/format.js` — `LOCALE = 'en-PH'` pero `toLocaleDateString/String` ay **walang `timeZone: 'Asia/Manila'`** (lines 37, 43). Ang display ay sumusunod sa timezone ng browser ng admin.
- **Epekto sa admin:** ang **"Scheduled" announcement** ay ipinapakita sa oras ng browser; ang admin na nag-oopen mula sa ibang zone (o VPN/laptop na mali ang zone) ay makakakita ng ibang oras kaysa sa Maria/Juan sa mobile para sa parehong ISO value. Pareho sa `CreateAnnouncementModal` — ang `datetime-local` ay local time ng browser at kino-convert sa UTC ISO (tama), pero ang pag-display pabalik ay walang nakapirming zone → hindi magkatugma ang input at display kapag iba ang zone.
- **Dapat gawin:** idagdag ang `timeZone: 'Asia/Manila'` sa lahat ng format helper (isang constant), at i-label ang scheduler input ng "(Philippine time)" — o i-convert ang input mula sa Manila. Ang `formatRelative` ay okay (pure diff).
- Katabing obserbasyon: ang `min={minScheduleAt}` ng scheduler ay kinukuha **isang beses sa mount** (`CreateAnnouncementModal.jsx:38`), kaya kung bukas ang modal nang matagal, ang "future" validation sa `validate()` ay tama pa rin (nire-check ang `Date.now()` sa submit) pero ang `min` ay luma. Maliit.

### A6. Dead code na nakita
| Item | File | Aksyon |
|---|---|---|
| `useDebounce`, `useDebouncedCallback` | `shared/hooks/useDebounce.js` (export sa `index.js`) | **Walang ni isang gumagamit** (grep). Gamitin sa A3 — huwag tanggalin. |
| `// TODO(refactor): shared/ should not import features/` | `Layout.jsx:6` | Kilalang utang; ilipat ang `AuthContext` sa `core/` (hindi urgent). |

(Hindi ko ni-scan ang buong `src` para sa lahat ng unused export gaya ng ginawa sa mobile; i-run ang parehong "export na isang beses lang lumalabas" scan bago maglinis.)

### A7. Announcements — mga puwang sa UX (pinakamalapit sa mobile #5/#11 "editable, schedule")
- **File:** `Announcements.jsx`, `CreateAnnouncementModal.jsx`
- **Walang edit at walang "cancel schedule":** ang **Scheduled** announcement ay maaari lamang i-**delete** (permanent, kailangan i-type ang `DELETE`) at gawin ulit; walang "Edit" o "Unschedule". Kung tama ito bilang rule ("create + delete only"), ilagay sa `Help.jsx`; kung hindi, ito ang katumbas ng mobile #5 (editable).
- **Walang unsaved-changes guard / autosave** sa modal: ang `Modal` backdrop ay `onMouseDown={onClose}` (`ui.jsx:144`) — ang pag-drag para mag-select ng teksto na lumabas sa labas ng dialog, o aksidenteng click sa labas, **magsasara at mawawala ang tinipang mensahe** (hanggang 4 na field). Ihambing sa mobile B.3 (`useUnsavedGuard`). Dapat: i-confirm kapag dirty, o gawing `onClick` na ang target ay mismong backdrop (hindi `mousedown`).
- **Walang preview/audience count** bago mag-"Post now" (lahat ng estudyante at instructor = malawak na epekto) — isaalang-alang ang confirm step para sa `audience: 'all'`.

### A8. Maliit na puna sa pagkakapare-pareho
- **Duplicate na title:** ipinapakita ng `Topbar` ang `page.title` (`Topbar.jsx:29`) at ang `PageHeader` ay `<h1>` na may parehong title sa ilalim lang nito. Nakikita ang pangalan ng page nang dalawang beses sa halos magkatabing lugar (lalo sa desktop). Pumili ng isa: panatilihin ang `h1` at gawing breadcrumb/section label ang topbar, o alisin ang topbar title sa desktop.
- **`Tabs` — walang overflow strategy kung dadami:** ngayon ay `flex-wrap`, kaya ligtas sa 2–3 tab; kung lalagpas sa ~6 sa makitid na screen, mag-wrap sa maraming linya (hindi sira, pero tumataas ang header). Walang aksyon ngayon.
- **`Account.jsx` Step labels** (`Step 1/2/3`) ay hindi `<ol>`/landmarks; minor a11y.

---

## 3. Mga bagay na **maayos na** (huwag galawin)

### B1. Accessibility at consistency — mas mahusay kaysa sa mobile
- `Tabs`: tamang `tablist/tab`, `aria-selected`, roving tabindex, arrow/Home/End, `aria-controls` ✅
- `Modal`: focus papasok, focus trap, ibinabalik ang focus sa opener, `aria-modal`, `aria-describedby`, `data-autofocus` ✅
- `ConfirmDialog`: type-to-confirm (`DELETE`), `busy` ay humaharang sa close at sa confirm, body unmount = walang stale na typed word ✅
- `Toast`: `role="alert"` para sa error, `status` para sa success ✅
- Skip link, `aria-label` sa icon buttons, `aria-invalid` + `field-error`, caps-lock hint, lockout countdown sa Login ✅
- Isang `<h1>` kada page (`PageHeader`), `useDocumentTitle` sa bawat route ✅
- Responsive: drawer sidebar ≤1024px, stacked cards sa DataTable ≤720px, stat-grid collapse, may `prefers-reduced-motion` ✅
- Walang "magic number" na bleed/negatibong margin (ang ugat ng #7/#9 sa mobile) ✅

### B2. Mock vs remote — malinaw ang pagkakahiwalay (kabaligtaran ng problema sa mobile)
- `api.js:20` — `import.meta.env.VITE_USE_MOCK !== 'false'` ay literal para ma-tree-shake ang mock (kasama ang hard-coded admin password) sa production build ✅ *(hindi ko pa na-verify sa totoong `npm run build`)*
- `Topbar` ay nagpapakita ng **"Mock data" pill** kapag mock ✅ — ito mismo ang "Demo data badge" na inirekomenda sa mobile doc D.
- Demo credentials ay lalabas lang kapag `getDemoCredentials()` ay may laman (mock) ✅
- `VITE_DATA_SOURCE=remote` ay ruta lang para sa login/logout (`api.js:28`), at ang natitira ay sumusunod sa `VITE_USE_MOCK` — **may parehong "halo ng remote auth + mock data"** na nasa mobile D. Ang Mock pill ay sapat na babala (kung `USE_MOCK=true`); siguraduhin lang na ito ay tama ding lumalabas kapag `DATA_SOURCE=remote` pero `USE_MOCK=true` (ginagamit ng pill ang `env.useMock`, kaya OK).
- Isang bug lang dito: ang `devCode` leak sa A2 #2.

---

## 4. Mungkahing pagkakasunod (priority)

**Batch 1 — Quick wins (≤ 0.5 araw)**
1. **A2 #2** — i-gate/alisin ang `devCode` sa toast (seguridad; isang linya).
2. **A3** — `replace: true` para sa `q` + gamitin ang `useDebounce` (inaayos ang history spam at request spam sa 6 na page).
3. **A4** — single-flight guard sa `useMutation`.
4. **A2 #6** — gamitin ang `formatCountdown` sa resend label.

**Batch 2 — Correctness (0.5–1 araw)**
5. **A5** — `timeZone: 'Asia/Manila'` sa `format.js` + label sa scheduler.
6. **A1** — refresh ng nav counts pagkatapos mag-mark-read; detail view ng notification.
7. **A7** — dirty-guard sa `CreateAnnouncementModal`; ayusin ang backdrop `mousedown`.

**Batch 3 — Desisyon bago i-code**
8. **A2 #1** — gusto mo bang may profile edit (OTP-protected) ang admin, o i-correct lang ang subtitle?
9. **A7** — payagan ba ang edit/unschedule ng scheduled announcement?
10. **A8** — alin ang titulo na mananatili: Topbar o PageHeader?

## 5. Mga file na malamang mabago
`shared/hooks/useQueryState.js` · `shared/hooks/useAsync.js` · `shared/hooks/useDebounce.js` (gamitin) · `core/logic/format.js` · `shared/components/Layout.jsx` + `Topbar.jsx` (nav counts refresh) · `shared/components/ui.jsx` (Modal backdrop) · `features/notifications/pages/Notifications.jsx` · `features/settings/pages/Account.jsx` · `features/announcements/{pages/Announcements.jsx,components/CreateAnnouncementModal.jsx}` · mga page na may `q` input (`Classes`, `Content`, `UserFilters`, `AuditLog`, `LoginAttempts`) · `docs/api-contract.md` (kung magdagdag ng profile OTP purpose).

> Workflow reminder (CLAUDE.md): `npm run lint` at `npm run build` sa `studia-admin/` bago i-declare ang anumang admin task na tapos. Walang test runner sa admin — ang mga pure na function na binanggit dito (format/timezone, `useQueryState`) ang magandang unang target kung magdadagdag ng `vitest`.
