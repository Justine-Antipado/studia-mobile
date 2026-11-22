# Admin vs shared DB vs mobile UI audit

> Audit only. Walang binago sa code. Petsa: 2026-11-23.
> Saklaw: `studia-admin/src`, `supabase/migrations` (001–020), `studia-mobile/src`, `docs/api-contract.md`.
> Hindi pinatakbo ang app; static na pagbasa lang.

## Buod

Maganda ang disenyo ng admin, pero **hindi pa ito nakakabit sa shared database**. Ang `login` lang ang totoong Supabase. Lahat ng iba ay tumatakbo sa `core/data/mock/mockBackend.js`. Kapag `VITE_USE_MOCK=false`, ang `httpBackend` ay tumatawag sa `/api/admin/*` na wala pang implementasyon: ang `backend/` ay skeleton, at ang `supabase/functions` ay `send-push` lang. Kaya **ang ginagawa ng admin ngayon ay walang epekto sa mobile app**.

## 1. Announcement / policy na ipo-post ng admin

- May `platform_announcements` table (audience: `all`, `students`, `instructors`, `course`; status `scheduled` o `published`) at RLS para sa mga user. Tugma ang form ng admin dito.
- **Walang binabasa ang mobile mula sa `platform_announcements`.** Zero ang grep hit sa `studia-mobile/src`. Per-class lang ang announcements ng mobile (`announcements-remote.ts`, `.eq("class_id", …)`).
- Walang DB trigger na gumagawa ng `notifications` row (at push) kapag nag-publish ang admin. Class announcements lang ang may fan-out (migration 017).
- Walang job na nagpapalit ng `scheduled` → `published` pagdating ng `scheduled_at`.
- Walang mobile UI (student o instructor) para sa platform notice: walang banner, inbox, o detail screen.
- Ang "policy" (terms, privacy, security policy) ay nasa `settings` (`legal`, `security_policy`). Walang mobile screen na nagpapakita ng terms/privacy mula sa DB.

## 2. Maintenance: hindi gagana kahit naka-ON

- May gate sa admin (`core/logic/maintenance.js`) at sa mobile (`core/logic/maintenance.ts`), pareho ang logic. **Walang file na nag-i-import ng `maintenance.ts`**, kaya walang layout o screen na nagba-block.
- **Hinaharang ng RLS.** Migration 008: `settings_select` ay `using (section not in ('backup','system'))`. Nasa `system` section ang maintenance, kaya hindi ito mababasa ng mobile.
- **Hindi tugma ang shape.** Seed (`supabase/seed/csv/25_settings.csv`): `system = {maintenance_mode, app_version, up_to_date, timezone}`. Admin: `system.maintenance = {enabled, scope, roles, features, message, startsAt, endsAt}`. Walang migration o seed na may ganitong object.
- **Walang server-side enforcement.** Ang contract ay nagsasabing 503 ang sagot ng server, pero walang server. Walang RLS policy na tumitingin sa maintenance, kaya tuloy pa rin ang direktang Supabase calls ng mobile.
- **Feature IDs vs mobile:** `ai.quiz` ↔ `ai_feature = 'quiz_synthesizer'` sa DB. May `transcription` sa DB na wala sa listahan. Walang mapping ng `classes`, `content`, `assessments`, `reports`, `notifications` sa mobile routes.

Para gumana, kailangan ng:
1. Public-readable na maintenance config (view o RPC) na may tamang shape.
2. Mobile gate sa root `_layout` at bawat feature route.
3. Server o RLS enforcement para hindi ma-bypass.

## 3. Settings na hindi nababasa ng mobile

Walang `from("settings")` sa mobile. Hardcoded ang lahat:

| Admin setting | Dapat epekto sa mobile | Ngayon |
|---|---|---|
| `security_policy` (password rules, lockout, session timeout) | validation, idle timeout | hardcoded |
| `uploads` (types, max MB) | upload screens | hardcoded |
| `term` (school year, semester) | class creation | hindi nababasa |
| `ai` toggles | itago o i-disable ang AI screens | wala |
| `email` (OTP expiry, resend) | auth screen | hindi nababasa |
| `legal` | terms/privacy screen | wala |

Iba pang hindi pagkakatugma:
- Admin ay camelCase (`quizSynthesizer`, `schoolYear`, `maxVideoSizeMb`); seed ay snake_case. Kailangan ng mapper.
- Upload cap: seed `max_material_size_mb: 500`, pero migration 007 ay 40MB at 012 ay 50MB. Hindi malinaw kung alin ang totoo.

## 4. Users at accounts

- **`pending_approval`** ay nasa DB enum at hinahawakan ng mobile (`remote-auth-service.ts:199`). Pero sinasabi ng contract na "approval flow is gone" at walang approve/block sa admin Users page. Sa `handle_new_user`, laging `active` ang default, kaya hindi nagagamit ang status. Magdesisyon: tanggalin sa DB at mobile, o ibalik ang approve sa admin.
- Walang `admin_login` sa `otp_purpose` enum, at walang `admin_pending_login` sa `auth_token_kind`, pero ginagamit ito ng contract. Hindi pa naka-wire ang OTP step ng admin login sa Supabase (sinasabi ng `remoteAuth.js` mismo).
- `deleteUsers` ay hard delete sa contract, pero may `deleted_at` ang DB, at `users.id → auth.users on delete cascade`. Walang delete grant sa `authenticated`, kaya service role lang ang makakagawa.
- Contract: status ay `Active`/`Inactive` lang at walang block/unblock, kaya walang paraan sa admin para i-deactivate ang account.

## 5. Hindi makakabasa ang admin gamit ang sariling session

Migration 008 ay nag-drop ng admin read sa `audit_log`, `backup_runs`, `security_findings`, `ai_requests`, at `class_enrollments`. Kaya **hindi puwedeng direktang Supabase query ang admin** para sa Audit Log, Backup, Vulnerabilities, AI health, at rosters. Kailangan ng server (edge function o `studia-api`) na may service role. Wala pa ito sa repo. Ang `VITE_API_URL=https://studia-api-mu.vercel.app` ay hindi ko ma-verify.

## 6. Admin pages vs DB

| Admin page | DB source | Status |
|---|---|---|
| Sessions | `sessions` | table meron; walang nagsusulat (mobile ay Supabase Auth) |
| Login attempts | `login_attempts` | table meron; walang `stage`/`note` na nasa contract |
| Vulnerabilities | `security_findings` | table meron; walang scanner |
| Backup | `backup_runs` | table meron; walang tumatakbong backup |
| Reports | derived | `struggling_concepts` placeholder; may `quiz_questions.concept` na |
| AI Health | `ai_requests` | walang AI backend, laging walang laman |
| Notifications (admin inbox) | `notifications` (`job`, `storage`, `security`) | tugma ang enum; walang gumagawa ng rows |
| Help / Legal | static / `settings.legal` | OK |

## 7. Nasa mobile pero wala sa admin

- Class announcement comments (`announcement_comments`, may `deleted_by`): walang moderation view.
- Submissions, grades, gradebook, planner, material views: walang per-student progress sa admin.
- Avatars (migration 015) at `phone`: hindi ipinapakita sa user detail.
- Push notifications (migration 019): walang admin visibility.

## Mungkahing ayos

1. Magdesisyon ng backend: Supabase Edge Functions (mas malapit) o PHP.
2. Maintenance: migration para sa public-readable config, mobile gate sa root layout at bawat feature, at server enforcement.
3. Platform announcements: mobile banner/inbox, notification trigger, at scheduled → published job (`pg_cron`).
4. Ikonekta ang admin repositories sa Supabase/edge functions at alisin ang mock.
5. I-sync ang settings keys, upload limits, at `pending_approval`.
