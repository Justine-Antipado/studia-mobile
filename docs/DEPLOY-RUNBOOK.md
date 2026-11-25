# Deploy runbook — security audit fixes to production

**Written for:** whoever runs the deployment (the Studia team, or a Claude Code session they hand
this to). Read the whole thing before running the first command.

**Target:** the live Supabase project `chvibqjstucybirsmpwu`, `studia-api` on Vercel, the admin site
on Vercel, and a mobile build through EAS. There is no staging project.

**State as of 2026-11-26:** everything is committed and pushed to `main` (`8904540`). **Nothing is
deployed.** The live system is still running the pre-audit code.

---

## 0. The one thing that will break everything

**`studia-api` and the migrations are all-or-nothing, and the database goes first.**

The new `login.ts` calls `private.login_lock_state` and `private.record_login_attempt` on *every*
sign-in, before the password is even checked. Those functions arrive in migrations 032 and 038. So:

> Deploying `studia-api` before `supabase db push` makes **every login fail** — student, instructor
> and admin. The app is dead until the migrations land.

The same coupling, in the other direction, for the mobile build:

| New code needs | From | If missing |
|---|---|---|
| `person_names()` | 031 | the class Stream tab errors out |
| `start_quiz()` | 033 | students cannot open a quiz at all |
| `login_lock_state`, `record_login_attempt` | 032, 038 | **every login fails** |
| `otp_send_wait`, `otp_codes.throttle_key` | 038 | every emailed code fails |
| `spend_otp_attempt` | 032 | wrong-code handling fails |
| `reserve_ai_request`, `save_material_summary` | 035 | AI chat, quiz generator, summaries fail |
| `audit_admin_event`, `admin_login` enum | 036, 037 | admin sign-in fails |

The admin **site** is the exception: it deploys safely on its own. `remoteAuth.js` falls back to the
old single-step sign-in when the API does not return `otpRequired`, so the new admin site works
against the old API. Deploying it alone removes the System tab and adds the Pending/Approve UI
(which stays empty until migration 030).

**There are no down-migrations.** Everything here is one-way. Take a backup first (step 1).

---

## 1. Before you start

Have these to hand:

- **Supabase access token** — `npx supabase@latest login` opens a browser.
- **Database password** — Supabase dashboard → Project Settings → Database. `db push` asks for it.
- **Vercel access** to both projects (`studia-api`, the admin site).
- **Expo/EAS access** for the mobile build.

Then take a backup, because nothing below can be undone:

```bash
# Supabase dashboard → Database → Backups → "Create backup" (or Point-in-Time Recovery if enabled).
# Write down the timestamp. This is your only way back.
```

Check what is live now, so you can tell afterwards whether something changed that should not have:

```bash
curl -s https://studia-api-mu.vercel.app/api/health          # {"ok":true,...}
```

---

## 2. Database (migrations 030 → 040)

```bash
cd c:\studia-mobile
git pull                                                     # make sure you are on 8904540 or later
npx supabase@latest login
npx supabase@latest link --project-ref chvibqjstucybirsmpwu
npx supabase@latest migration list                           # shows what is already applied
npx supabase@latest db push                                  # applies 030..040 in file order
```

`db push` applies them in filename order and stops at the first failure. **If it stops, do not
re-run it blindly** — read the error, fix the migration file, commit, and push again. A half-applied
set is the one state this plan does not cover; that is what the backup is for.

### What changes for live users the moment this lands

| Change | Who notices | Migration |
|---|---|---|
| Comment authors show "Classmate" instead of a name | every user, until the new mobile build ships | 031 |
| Campus announcements stop sending email (push + Alerts still work) | everyone | `send-push` env, see step 5 |
| A new instructor sign-up waits for admin approval | anyone registering as an instructor | 030 |
| Maintenance mode is off and cannot be turned on | nobody (it was off) | 040 |
| The login lockout and OTP caps actually hold | only an attacker | 032, 038 |

The "Classmate" regression is cosmetic and disappears when step 6 ships. If that is not acceptable
for a demo, hold migration 031 back: move `supabase/migrations/20260101000031_classmate_name_privacy.sql`
out of the folder, run `db push`, ship the mobile build, then put it back and push again. **Do not
hold back any other migration** — the rest are load-bearing for `studia-api`.

### Then regenerate the types

```bash
npx supabase@latest gen types typescript --linked > shared-types/database.types.ts
```

That file is generated and was stale before these migrations, which is why
`studia-api/src/lib/clients.ts` has an `untyped()` escape hatch. Once the types are regenerated, the
casts that use it can be replaced with typed `db.rpc(...)` calls — the doc comment on `untyped` lists
where. Not urgent, but leaving it means the next person cannot tell which casts are still needed.

```bash
cd studia-api && npx tsc --noEmit        # should still pass against the new types
```

---

## 3. `studia-api` (Vercel)

Only after step 2 succeeded.

**Set this environment variable first**, before deploying:

```
ADMIN_OTP = on
```

It is the default, so you can also leave it unset — but setting it explicitly means you know where
the switch is. See step 4.

Check the rest are still set: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`ALLOWED_ORIGINS` (the admin site's origin — the API now logs a warning when it is empty, and
browser calls fail without it), `AI_API_KEY`.

Deploy, then smoke-test in this order:

```bash
curl -s https://studia-api-mu.vercel.app/api/health
```

1. **Student or instructor sign-in** from the existing mobile app. This is the one that proves the
   migrations and the API agree. If it fails, `ADMIN_OTP` is irrelevant — roll back the API
   deployment immediately and read the function logs.
2. **Wrong password five times**, then a sixth — the sixth should say "Too many attempts. Try again
   in Ns." That is migration 032 working.
3. **Admin sign-in** — see step 4.

---

## 4. The admin's sign-in code — test this before you rely on it

This flow is new and **has never been run against a live project.** A correct admin password now
emails a 6-digit code, and the session only exists after the code is verified.

```
1. Open the admin portal, sign in with the admin password.
2. Expect: the OTP form, showing a masked address (e.g. "ju•••••@gmail.com").
3. Check that inbox. The code arrives through Supabase Auth's SMTP, the same sender that
   already handles sign-up and password-reset codes.
4. Enter it. You should land in the portal.
```

**If the code does not arrive:**

```
Vercel → studia-api → Settings → Environment Variables → ADMIN_OTP = off → redeploy
```

That falls back to password-only admin sign-in in about a minute, and the audit log records it as
"Administrator signed in (sign-in code disabled)" so the gap is visible afterwards. Set it back to
`on` once the mail problem is fixed — it is the difference between one secret and two protecting the
account that can read every user's record and delete users and classes.

Supabase Auth rate-limits outbound mail. If you test this repeatedly you will hit that limit and the
code will stop arriving for reasons that have nothing to do with the code. Wait an hour, or check
Supabase → Auth → Rate Limits.

---

## 5. Admin site and the push function

**Admin site (Vercel):** deploy. No environment change.

> **Two deployment failures bit this step on 2026-11-26; both are fixed, but know the symptoms.**
>
> 1. **`vercel.json` schema validation.** The file used `"//"` keys as comments. Vercel validates
>    `vercel.json` against a strict schema and rejects unknown properties, so every Git-triggered
>    build failed with ``headers[0].headers[0] should NOT have additional property `//` `` — which
>    meant the security headers below had **never once reached production**. The keys are gone and
>    their reasoning now lives in [`studia-admin/README.md`](../studia-admin/README.md). Do not add
>    them back.
> 2. **"The commit author did not have contributing access."** The Hobby plan will not build a
>    commit authored by someone other than the Vercel project owner while the repo is private.
>    Local git commits as `Oustinn11252005 <justinemagpantay39@gmail.com>`; the Vercel account is
>    `justineantipado10-9065`. Deploy from the CLI, which authenticates as you and skips the check:
>
>    ```bash
>    cd studia-admin && npx vercel --prod
>    ```

Verify:

- Settings has **Legal** and **Account** tabs and no System tab.
- Users → status filter has **Pending approval**, and a pending instructor shows an **Approve**
  action. (Nothing is pending until someone registers as an instructor.)
- The new security headers are live: `curl -sI <admin-url> | grep -i content-security-policy`.
  `connect-src` must list the Supabase project and `studia-api` — if either is wrong the portal
  cannot talk to its own backend, and the browser console will say so.

**`send-push` edge function:** redeploy it, because the batching and ticket-handling fixes are in it.

```bash
npx supabase@latest functions deploy send-push
```

Campus announcements no longer email by default: one announcement meant one SMTP message per
student, which would exhaust the Gmail quota and then silently take email down for everything else
that day — class announcements included. Push and the in-app Alerts tab still deliver them. To turn
email back on (only on a Workspace account with headroom for the whole campus):

```bash
npx supabase@latest secrets set EMAIL_CAMPUS_ANNOUNCEMENTS=true
```

---

## 6. Mobile build (EAS)

Last, and only after steps 2-3 are confirmed working.

```bash
cd studia-mobile
npx tsc --noEmit && npx expo lint && npx jest     # all three were clean at 8904540
npx eas-cli@latest build --profile production --platform android
```

Then verify on a device, specifically the things that changed:

| Check | Why |
|---|---|
| Open a class → Stream tab, with comments from other students | `person_names()` (031). Names must show, not "Classmate" |
| Open a timed quiz, close the app, reopen it | `start_quiz()` (033). The timer must **resume**, not restart |
| Submit that quiz | `submit_quiz` finalises the attempt start_quiz opened |
| AI assistant: two messages in a row | history now comes from the server, not the client |
| A lesson's AI summary | `save_material_summary()` (035) |
| Account → Personal information, change your name with the emailed code | the column grants are revoked (034), so this must go through the API |
| Terms of use / Privacy on the explore screen | `app_status()` still serves legal text after 040 |

Keep the previous build installable. If the new one is broken, that is your rollback.

---

## 7. Two behaviours that are decisions, not bugs

Both were deliberate. If a reviewer asks why, this is the answer.

**An over-time quiz attempt is scored and flagged, not rejected.** `start_quiz` stamps `started_at`
from the database clock and `submit_quiz` measures the time limit against it (with two minutes of
grace for clock skew and slow uploads). Past that, the attempt is marked `over_time` and shows an
"Over time" badge beside "Late" when grading — but the answers are still scored. Refusing the
submission would throw away a student's work, and what an over-time attempt is worth is an academic
decision, not a database rule. If you want a penalty, that is a grading policy to add on top.

**Campus announcements no longer email.** See step 5.

---

## 8. If it goes wrong

| Symptom | Cause | Action |
|---|---|---|
| Every login fails right after the API deploy | migrations not applied, or `db push` partially failed | roll back the Vercel deployment to the previous one; then fix the migrations |
| Admin cannot sign in, students can | the sign-in code is not being delivered | `ADMIN_OTP=off`, redeploy (step 4) |
| Comment authors all say "Classmate" | migration 031 applied, mobile build not shipped | expected; ship step 6 |
| Students cannot open a quiz | new mobile build without migration 033 | apply the migrations |
| Admin portal cannot reach its backend | `connect-src` in `studia-admin/vercel.json` does not match the real hosts | fix the two URLs, redeploy |
| `db push` fails halfway | a migration has an error | **do not re-run blindly.** Read the error; a `create or replace` whose argument list changed creates an overload instead of replacing (this bit migration 038 once, which is why it has an explicit `drop function`) |
| Something is wrong with the data | — | restore the backup from step 1 |

---

## 9. What is documented where

- [`docs/reports.md`](reports.md) — the audit: all 30 findings, what was fixed and how, and what was
  verified as already correct. Each finding names the file and line.
- `supabase/migrations/030`–`040` — each migration's header explains what was wrong, why the fix is
  shaped the way it is, and what it deliberately leaves alone. Read these before changing them.
- [`CLAUDE.md`](../CLAUDE.md) — updated: maintenance mode is gone, the legal text path remains.

Two things are **not** fixed, on purpose, and `docs/reports.md` says why: account enumeration on
sign-up (an acknowledged product trade-off the code documents) and the shallow settings merge.
