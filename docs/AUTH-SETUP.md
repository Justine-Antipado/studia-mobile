# Phase 3 auth: what YOU must set up

Allowed sign-up emails: `@gmail.com` only (campus owns no mail domain we can send from, so any Google
account works; migration 010). Enforced in the database (Auth hook), not just in the app. To change it, edit
`ALLOWED_DOMAINS`/`EMAIL_RE` in `studia-api/src/lib/policy.ts` **and** `private.hook_before_user_created` + the
`users_email_domain` constraint (migration 009).

## 1. Apply the code (dev first, then prod)
```bash
supabase link --project-ref chvibqjstucybirsmpwu     # studia-dev
supabase db push --remote                              # migration 009
supabase config push                                   # config.toml: OTP 6 digits / 5 min / 30 s, hook, Google, SMTP, templates
```
`config.toml` reads secrets from env: set `SMTP_USER`, `SMTP_PASS`, `GOOGLE_CLIENT_IDS`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
in your shell before `config push` (never commit them). If you prefer the dashboard, the same settings live under
Authentication > Providers/Hooks/Emails/SMTP. Then regenerate types: `supabase gen types typescript --linked > shared-types/database.types.ts`
(this phase's types were patched by hand: `users.profile_completed`, nullable `otp_codes.code_hash`).

## 2. Email sender (Gmail SMTP, no domain needed)
Google sign-in needs no domain, but the 6-digit codes are emails, so Supabase needs an SMTP sender. Without a domain, use a **dedicated** Gmail account (not your personal one):
1. Create e.g. `studia.noreply@gmail.com`, turn on 2-Step Verification.
2. myaccount.google.com > Security > App passwords > create one named "Studia" (16 characters, no spaces).
3. `SMTP_USER` = that Gmail address, `SMTP_PASS` = the app password (shell env for `config push`, or paste in dashboard SMTP form: host `smtp.gmail.com`, port `465`).
4. In `supabase/config.toml` set `admin_email` to the same Gmail address.
5. Test a signup and check spam. Limit is about 500 mails/day and Gmail may show "via supabase" headers; fine for a pilot.
Upgrade path: with a domain you own, Resend (`smtp.resend.com`, user `resend`, key as password, SPF/DKIM/MX/DMARC records) gives better deliverability. Only the SMTP block changes.

## 3. Google Cloud OAuth clients (one project, consent screen "External", publish to Production later)
Create **three** OAuth client IDs (APIs & Services > Credentials):
| Type | Needed values | Used by |
|---|---|---|
| **Web application** | Authorized redirect URI: `https://chvibqjstucybirsmpwu.supabase.co/auth/v1/callback` (and the prod ref's). Authorized JS origins: your admin URL | Supabase (client secret), mobile `webClientId`, admin web OAuth |
| **Android** | Package `com.group4.studiamobile` + **SHA-1** of the build keystore (`eas credentials` shows it; add the debug + EAS + Play App Signing SHA-1s) | Android native sign-in |
| **iOS** | Bundle id `com.group4.studiamobile` | iOS native sign-in |

Then:
- `GOOGLE_CLIENT_IDS` (Supabase) = `<web>,<android>,<ios>` (comma separated, **web first**).
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` = the Web client secret.
- EAS env: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
- `studia-mobile/app.json`: replace `iosUrlScheme` with `com.googleusercontent.apps.<iOS client id suffix>`.
- Native Google sign-in needs a **development or EAS build** (`eas build --profile development`), not Expo Go.
- If Supabase logs "nonce" errors from native tokens, set `skip_nonce_check = true` in `[auth.external.google]`.

## 4. Vercel (`studia-api` project, Production + Preview)
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (you paste this), `ALLOWED_ORIGINS` = admin site origin(s), comma separated. Redeploy.
Mobile (EAS) and admin (Vercel `studia-admin`) get `*_DATA_SOURCE=remote`, `*_API_URL=https://studia-api-mu.vercel.app`, and the public Supabase URL/anon key.

## 5. Residual risks (be aware)
- OTP attempt limit (5) and the 30 s resend gap are enforced by `studia-api`. Supabase Auth itself can still be called directly with the public anon key; there it is limited only by its IP rate limits (`token_verifications` 30 / 5 min) and the 5-minute expiry. Same for the login lockout. Closing this fully needs the Auth "password verification" hook (paid plans) or a custom send-email hook.
- Admin session lives in `localStorage` (supabase-js). Ship a strict CSP on the admin site.
- Not in this phase: device list in `public.sessions`, admin account OTP/password change screens (still mock), admin Google button (needs a UI change), auto-redirect of a restored mobile session (needs a UI change).
