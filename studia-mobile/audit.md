# audit.md — studia-mobile: router, logic, dead code, silent-failure risk

> **Audit only. Walang code na binago.** Petsa: 2026-11-28.
> Paraan: code inspection (read/grep ng source), `npx tsc --noEmit`, `npx expo lint`. Hindi tinest sa
> device/emulator — ang mga "pwede mangyari" na silent failure sa seksyon 4 ay traced mula sa code
> path, hindi na-trigger sa runtime.
> Hindi pinagkatiwalaan ang lumang `UI-MOBILE-AUDIT.md` (2026-11-22, isinulat habang nandon pa ang
> mock layer) — bawat claim dito ay na-verify laban sa current na code.

## 0. Buod

| Area | Status | Pinaka-importante |
|---|---|---|
| Router (`app/`, `_layout.tsx`, `SUBPAGE_ROUTES`/`MODAL_ROUTES`) | ✅ Clean | Lahat ng route registration tugma sa files at sa push call sites; walang dead o missing route |
| Logic/functions (`core/data`, `core/logic`, feature `logic/`/`hooks/`) | ⚠️ 1 critical, ilang moderate | `restoreRemoteSession` nagsasara ng session kapag nabigo lang ang network query (hindi na-check ang `error`) |
| Dead code | ⚠️ 3 items | `registerPushToken` (push reg caller naka-comment out), `QueryCache.fetch()` hindi ginagamit, stale `__DEV__` demo-user comment |
| Silent-failure risk | ⚠️ 5 points | Ang buong error sink (`reportError`) ay no-op sa production — walang crash/error telemetry kahit saan sa app |
| `tsc --noEmit` | ✅ walang error | |
| `expo lint` | ⚠️ 1 warning | `registerPushToken` unused (kasabay ng dead-code finding sa itaas) |

---

## 1. Router audit

**Pamamaraan:** binasa ang `app/student/_layout.tsx` at `app/instructor/_layout.tsx`, kinunan ng listahan
ang `SUBPAGE_ROUTES`/`MODAL_ROUTES`, at itinapat sa (a) ang mga `.tsx` file na talagang nasa `app/<role>/`,
at (b) lahat ng `router.push/replace/navigate(...)` string-literal destination sa `src/features`,
`src/shared`, `src/core` (~80 call sites, hinalungkat lahat).

- **Student**: 16 file sa `app/student/` (hindi kasama `(tabs)` at `_layout`) = eksaktong 13
  `SUBPAGE_ROUTES` + 3 `MODAL_ROUTES` (`join-class`, `quiz-take`, `add-plan`). Tugma. — [student/_layout.tsx:25-41](src/app/student/_layout.tsx#L25-L41)
- **Instructor**: 26 file sa `app/instructor/` = eksaktong 18 `SUBPAGE_ROUTES` + 8 `MODAL_ROUTES`.
  Tugma. — [instructor/_layout.tsx:25-55](src/app/instructor/_layout.tsx#L25-L55)
- Walang nakitang "dead route" (registered pero walang `router.push`/`.replace` patungo rito) at
  walang "orphan push" (push patungo sa isang pathname na walang Stack.Screen registration).
- Lahat ng 51 file sa `app/` (maliban sa `_layout.tsx`/`(tabs)/_layout.tsx`) ay eksaktong 1
  non-blank line (plain re-export) — walang file na may tunay na screen code sa loob ng `app/`.
  Na-verify ito programmatically (bilang ng non-blank lines kada file), hindi lang sample.
- **Role guard**: `RoleGate` (→ `useRoleGuard`) nakabalot sa *buong* `<Stack>` ng bawat role group
  (hindi per-screen), kaya automatic na saklaw ang lahat ng kasalukuyan at hinaharap na subpage/modal
  — walang paraang makalusot ang isang bagong route na hindi na-guard.
  [student/_layout.tsx:48-62](src/app/student/_layout.tsx#L48-L62),
  [use-role-guard.ts:28-46](src/core/logic/use-role-guard.ts#L28-L46)
- **String-literal paths**: lahat ng destination ay string literal (walang typed route helper/enum).
  Walang nakitang typo/mismatch sa 80 call sites na na-grep, pero may-risk sa hinaharap kung
  magdadagdag ng route nang hindi pareho ang spelling sa `SUBPAGE_ROUTES`/`MODAL_ROUTES` array —
  wala namang compile-time na proteksyon laban dito (TypeScript sees `string`, hindi union literal).
- **Correction sa lumang audit**: ang claim na "`getId` sa lahat ng Stack.Screen" ay *outdated* —
  pinalitan na ito ng Expo Router mismo ng `dangerouslySingular` (parehong mekanismo, bagong pangalan).
  Dokumentado mismo sa comment: [screen-id.ts:1](src/core/logic/screen-id.ts#L1). Hindi ito bug, pagbabago lang ng API — ginagamit nang tama sa dalawang layout.

**Konklusyon:** malinis ang router layer. Walang dead/missing/mismatched route na nakita.

---

## 2. Logic/functions review

### 2.1 — CRITICAL: valid session na-silent-sign-out kapag nabigo lang ang network (hindi talaga deactivated)

[remote-auth-service.ts:264-274](src/features/auth/data/remote-auth-service.ts#L264-L274)

```ts
const { data: row } = await db.from("users").select(...).eq("id", data.session.user.id).maybeSingle();
if (!row || row.status !== "active" || row.role === "admin") {
  await db.auth.signOut({ scope: "local" }).catch(() => undefined);
  return;
}
```

Hindi kinukuha/chineck ang `error` sa destructure. Kapag nabigo ang query (walang internet sa cold
start, timeout, Supabase flaky) `row` ay `null/undefined` — eksaktong parehong path gamit kung
*talagang* na-deactivate o na-delete ang account. Resulta: binubura ang lokal na session
(`signOut({scope:"local"})`) ng isang user na may perfectly valid refresh token, dahil lang hindi
naabot ang isang SELECT query.

**Ito ay kontra sa sariling disenyo ng codebase** — eksaktong parehong query shape (`from("users").select("status, deleted_at")...maybeSingle()`) ay ginagamit sa `live-updates.ts`, at *doon* ay sadyang
ni-reason-out at ginawa nang tama:

> [live-updates.ts:61-68](src/core/logic/live-updates.ts#L61-L68) — "A failed read (offline, a slow
> reconnect...) is not proof the account was deactivated — it is proof we could not ask... Only a
> row that actually says so may sign the device out; a failed check is retried next time."

`live-updates.ts` ay may `if (error) return;` bago tingnan ang `isBlocked(row)`. `remote-auth-service.ts`
ay wala. Dalawang code path, parehong intensyon, hindi parehong implementasyon.

**Concrete failure scenario:** buksan ang app offline (o may matinding packet loss) ilang segundo
pagkatapos ng isang cold start kung saan may valid stored session. `getSession()` (local, SecureStore)
ay magbabalik ng session, pero ang susunod na network call (`.from("users")...`) ay mabibigo —
automatic na signed-out ang user papuntang `/auth`, kahit walang ginawang mali.

### 2.2 — Dokumentasyon ng DEV demo-user ay stale/mali (hindi bug sa production, pero nakalilito)

[use-role-guard.ts:25-26](src/core/logic/use-role-guard.ts#L25-L26):

> "Without a session it redirects to /auth (except in `__DEV__`, where session-store serves a demo
> user so a route can be opened directly after a hot reload)."

Pero sa [session-store.ts:22](src/core/data/storage/session-store.ts#L22), `current` ay nagsisimula
bilang `null` lagi — walang demo-user seeding kahit saan (hinalungkat ang lahat ng `setUser(` call
sites: `sign-out.ts`, `remote-auth-service.ts`, `auth-screen.tsx`, `profile-remote.ts` lang, walang
dev-only path). Ito ay leftover mula sa tinanggal na mock layer.

Hindi kritikal dahil lahat ng screen na gumagamit ng `useRoleUser`/`useUser` ay may
`if (!user) return null;` guard (`account-screen.tsx:27`, `account-personal-screen.tsx:68`,
`account-photo-screen.tsx:26`, `instructor/home-screen.tsx:48`, `student/home-screen.tsx:76`) —
kaya ang totoong epekto, sa `__DEV__` na walang session, ay blangkong screen, hindi crash. Pero
mali ang comment at pwedeng maglito sa susunod na nagbabasa nito.

### 2.3 — `QueryCache.fetch()` (request dedup) hindi ginagamit ng `useQuery` — ang documented guarantee ay hindi totoo sa totoong hook

[query-cache.ts:2](src/core/data/cache/query-cache.ts#L2): "In-flight requests are deduped by key so
the same fetch is never issued twice at once" — ito ang ginagawa ng method na `fetch()`
([query-cache.ts:45-60](src/core/data/cache/query-cache.ts#L45-L60)). Pero `use-query.ts`, ang ISANG
hook na ginagamit ng bawat `useClasses()`/`useTasks()`/etc., hindi tumatawag dito — direktang
tinatawag ang `fetcher()` sa loob ng `withRetry(...)`
([use-query.ts:54-59](src/core/data/repository/use-query.ts#L54-L59)). Na-verify: zero match sa
buong `src/` para sa `queryCache.fetch(`.

**Epekto:** kung dalawang component ay nag-mount ng parehong query key sa parehong sandali (hal.
isang badge counter at ang buong listahan, pareho umaasa sa `"instructor:classes"`), magpapaputok
sila ng DALAWANG hiwalay na network request — ang dedup na ipinangangako ng comment sa itaas ay
hindi aktwal na nagaganap sa pangunahing data path ng app. Hindi ito nasusulat kahit saan bilang
"known limitation."

### 2.4 — Push-notification registration: naka-comment-out nang buo (tingnan 3.1 at 4.1)

Tinalakay sa dead-code at silent-failure section dahil tatlong usapan ito nang sabay (dead code +
intentional-pero-madaling-kalimutang disable + walang error na makikita).

---

## 3. Dead code

### 3.1 — `registerPushToken` dormant dahil naka-comment-out ang tanging caller nito

[push-notifications.ts:87-91](src/core/logic/push-notifications.ts#L87-L91) ang function; ang buong
block na dapat tumawag dito (`useEffect` sa `usePushNotifications`) ay naka-comment mula
[push-notifications.ts:112](src/core/logic/push-notifications.ts#L112) hanggang
[:141](src/core/logic/push-notifications.ts#L141), may malinaw na paalala sa Tagalog:

> "⬇️ DEV BUILD / APK: UNCOMMENT THIS WHOLE BLOCK... Pinatay muna para matest sa Expo Go"

`npx expo lint` mismo ang humuli nito: `'registerPushToken' is defined but never used`. Ibig
sabihin: **kasalukuyan, walang device — dev build man o production/EAS build — na nagpaparehistro
ng push token.** Severity: dead-code lang kung titigan nang mag-isa, pero functional na "ang feature
ay OFF sa lahat ng build ngayon" — see 4.1 kung paano ito nawawala nang tahimik.

### 3.2 — `QueryCache.fetch()` (unused method)

[query-cache.ts:45-60](src/core/data/cache/query-cache.ts#L45-L60) — hindi tinatawag kahit saan
(tingnan 2.3 para sa functional na epekto). Alisin o ikonekta sa `use-query.ts`.

### 3.3 — Pagkumpirma: walang natitirang mock-layer o maintenance-gate code

Hinalungkat ang buong `src/` para sa `EXPO_PUBLIC_DATA_SOURCE`, `mock-auth-service`, `core/data/mock`,
`maintenance`, `use-gate`, `gate-views`, `AppGate`, `RouteFeatureGate`, `FeatureGate` — isang tugma
lang, at comment lang ito na nagpapaliwanag kung bakit wala na ang mga ito
([app-status.ts:6-9](src/core/logic/app-status.ts#L6-L9)). Walang code reference na natitira. Tugma
sa sinasabi ng CLAUDE.md.

---

## 4. Silent-failure risk points ("pwede mangyari")

### 4.1 — SYSTEMIC: ang tanging error sink ng app ay sinasadyang no-op sa production

[report-error.ts:14-22](src/core/logic/report-error.ts#L14-L22):

```ts
export function reportError(error: unknown, context: ErrorContext): void {
  if (!__DEV__) {
    // TODO(P6): forward to the logging service (strip PII before sending).
    return;
  }
  ...
}
```

Sinadya ito (comment: "intentionally silent until a logging service is wired up"), pero ngayon
`reportError(...)` ay ang TANGING destinasyon ng:
- bawat `ErrorBoundary.componentDidCatch` (root, role-group, bawat screen) — [error-boundary.tsx:70-75](src/shared/components/ui/error-boundary.tsx#L70-L75)
- push-notification blocker reasons (expo-go/simulator/permission-denied/no-project-id) — [push-notifications.ts:50-56](src/core/logic/push-notifications.ts#L50-L56)
- `app_status()` fetch failures — [app-status.ts:60-62](src/core/logic/app-status.ts#L60-L62)
- font-load failure sa root layout — [_layout.tsx:60](src/app/_layout.tsx#L60)
- push unregister failures — [push-notifications.ts:100-102](src/core/logic/push-notifications.ts#L100-L102)

**Lahat ng nasa itaas ay invisible sa production kahit mag-crash nang madalas ang app sa totoong
users.** Walang crash/error telemetry provider na naka-wire ngayon — kung may production incident,
walang babalang signal maliban sa manual na ulat ng user.

### 4.2 — `restoreRemoteSession` silent local sign-out sa network failure

Tingnan 2.1 — pareho ring silent-failure risk mula sa punto ng view ng user: walang error message,
walang indikasyon — bigla lang silang nasa `/auth` screen.

### 4.3 — Draft autosave: tahimik na nabibigo ang save/restore, walang palatandaan sa user

[use-draft-autosave.ts:17-25](src/shared/hooks/use-draft-autosave.ts#L17-L25) (restore) at
[:36](src/shared/hooks/use-draft-autosave.ts#L36) /
[:44](src/shared/hooks/use-draft-autosave.ts#L44) (save/clear) — lahat `.catch(() => {})`. Kung
mabigo ang `AsyncStorage.setItem` (puno ang storage, corrupted), walang nangyayari — walang toast,
walang retry, walang log (hindi man lang tumawag sa `reportError`). Kung corrupted/truncated ang
nakatago (`JSON.parse` throws), ang `restored` flag ay nagiging `true` pa rin (sa `.finally`), kaya
tahimik lang babalik sa `initial` value — nawala ang draft ng isang quiz/assignment/announcement
nang walang anumang babala.

### 4.4 — Pre-auth flow (welcome/explore/auth/learn-more) walang sariling screen-level ErrorBoundary

Ang bawat post-login screen ay may per-screen `ErrorBoundary` dahil sa `Screen` wrapper
([screen.tsx:116-120](src/shared/components/ui/screen.tsx#L116-L120)), pero
`welcome-screen.tsx`, `explore-screen.tsx`, `auth-screen.tsx`, at `learn-more-screen.tsx` ay hindi
gumagamit ng `Screen` — walang ibang nagbabalot sa kanila kundi ang root-level
`ErrorBoundary scope="root"` ([_layout.tsx:77](src/app/_layout.tsx#L77)). Hindi malubha dahil
magandang pa rin ang fallback card nito ("Try again" / "Go home"), pero isang crash sa role-picker o
sa auth form ay papalitan ang BUONG app shell sa card na iyon, hindi lang ang isang screen — mas
magaspang ang recovery kompara sa bawat post-login screen.

### 4.5 — Minor: dalawang walang-lamang `catch` sa injected WebView JS

[youtube-player.tsx:29](src/shared/components/ui/youtube-player.tsx#L29) at
[:32](src/shared/components/ui/youtube-player.tsx#L32) — `catch(e){}` / `catch(x){}` sa isang JS
string na iniinject sa isang WebView (hindi RN code, kaya walang access sa `reportError`). Mababa
ang severity (karaniwang `postMessage` sa parent lang ang ginagawa rito), pero kasama para sa
kumpletong listahan.

---

## 5. Tool output

- `npx tsc --noEmit` — walang error.
- `npx expo lint` — 1 warning: `registerPushToken` is defined but never used
  (`src/core/logic/push-notifications.ts:87`) — see 3.1/4.1.
