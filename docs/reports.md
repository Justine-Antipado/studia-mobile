# Studia — Security, Logic, Concurrency and Error-Handling Audit

**Date:** 2026-11-26
**Reviewer:** static code review (Claude Code)
**Repo state:** branch `main`, commit `5cff3fa`, working tree clean

> ## Update 2026-11-26 — everything below is fixed except two items
>
> Migrations **030-039** were added, together with changes across `studia-api`, `studia-mobile`,
> `studia-admin` and the `send-push` edge function. Verified: `tsc --noEmit` clean in all three
> projects, `expo lint` 0 errors, 14/14 mobile jest tests, 6/6 studia-api tests (one new, for the
> throttle key), admin `oxlint` clean and `vite build` succeeding. **The SQL has not been executed** —
> there is no local database in this environment — so the migrations are reviewed, not run.
>
> | Finding | Where it was fixed |
> |---|---|
> | C1 instructor self-signup | 030 + `complete-profile.ts` + admin Users pages |
> | H1 classmate PII | 031 + `announcements-remote.ts` |
> | H2 reset status gate | `otp-verify.ts` |
> | H3 unverified-account lockout | `login.ts` |
> | H4 admin 2FA + token comment | 036, 037 + `login.ts`, `otp-verify.ts`, `remoteAuth.js`, `tokenStore.js` |
> | M1 OTP counter race | 032 + `auth-core.ts` |
> | M2 login lockout race | 032 + `auth-core.ts` |
> | M3 AI quota race | 035 + `ai-guard.ts` and the three AI endpoints |
> | M4 regeneration cap race | 035 + `summarize.ts` |
> | M5 objectives atomicity | 035 (+ unique index, with dedupe) |
> | M6 quiz time limit | 033 + `quizzes-remote.ts`, `quiz-take-screen.tsx` |
> | M7 answer key timing | 033 |
> | M8 push token takeover | 034 |
> | M10 profile-edit OTP bypass | 034 |
> | M11 admin CSP / framing | `vercel.json`, `index.html` |
> | M9 settings validation | 039 + `app-status.ts` (zod) |
> | L1 L3 L4 L5 L6 L7 L8 L9 L10 L11 L12 L13 L14 | see each row below |
>
> **Not fixed, deliberately:** **L2** (account enumeration via sign-up) is an acknowledged product
> trade-off the code already documents — changing it changes what users are told, which is not a
> reviewer's call. The **shallow settings merge** noted under M9 is left alone for the same reason:
> the admin UI sends whole sections today, so changing the merge would change what every existing
> caller means.
>
> **Two consequences need your decision, not more code:**
> 1. An over-time quiz attempt is **scored and flagged** (`quiz_attempts.over_time`, shown as an
>    "Over time" badge when grading), not rejected. Refusing it would discard a student's work; what
>    the penalty should be is an academic policy, not a database rule.
> 2. Campus-wide announcements **no longer send email** (push and the in-app Alerts tab still do).
>    One announcement meant one SMTP message per student, which would exhaust the Gmail quota and take
>    down email for everything else that day. `EMAIL_CAMPUS_ANNOUNCEMENTS=true` restores it.
>
> Nothing is deployed: the migrations need `supabase db push` **in file order**, `studia-api` and the
> admin site need a deploy, and the mobile changes need a build. Regenerate
> `shared-types/database.types.ts` after the push and the `untyped()` casts in
> `studia-api/src/lib/clients.ts` can go.

---

## 0. Scope and method

This is a **read-only code review**. Nothing was executed, no account was created, no request was
sent to the deployed services, and no code was changed.

### What was reviewed

| Area | Files |
|---|---|
| Serverless API | `studia-api/api/**` (12 handlers), `studia-api/src/lib/**`, `studia-api/src/ai/**` |
| Database | all 29 migrations in `supabase/migrations/`, RLS policies, `SECURITY DEFINER` functions, column grants |
| Edge function | `supabase/functions/send-push/index.ts` |
| Mobile client | auth/session/storage/gating layers in `studia-mobile/src/core` and `src/features/auth` |
| Admin client | `studia-admin/src/core/data/**`, `AuthContext.jsx`, `index.html` CSP, `vercel.json` |
| Secrets hygiene | `.gitignore` coverage, `git ls-files`, `git grep` for key material |

### What was **not** reviewed

- `backend/` — the PHP tree is a skeleton. `index.php` is **empty (0 bytes)**, and all 40+ files under
  `backend/src/` are placeholder `README.md`s. There is no PHP code to audit. The live backend is
  Supabase + `studia-api`.
- Runtime configuration that is not in the repo: Supabase project settings (is "Confirm email" on?
  Auth rate limits? Vault secrets?), Vercel environment variables (`ALLOWED_ORIGINS`, `AI_API_KEY`),
  Storage bucket settings. **Several findings below depend on these**; each one says so.
- No dynamic testing: no fuzzing, no race-condition reproduction, no RLS test suite run (migration
  008 mentions `supabase/tests/rls` and `npm test`, but that directory does not exist in the repo).

### Severity key

| | Meaning |
|---|---|
| **Critical** | Exploitable now by anyone, grants access or privileges they should not have |
| **High** | Exploitable by an authenticated user, or exposes personal data |
| **Medium** | Needs a race, a specific configuration, or an insider; or breaks an enforced rule |
| **Low** | Hardening, defence-in-depth, resilience, operational correctness |

### Summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 4 |
| Medium | 11 |
| Low | 14 |

The architecture is, on the whole, **better than average for a project of this size**: authorization
is enforced in the database rather than only in the client, every `SECURITY DEFINER` function pins
`search_path`, column-level grants stop the obvious self-escalations, and all 32 `admin_*` RPCs are
guarded. Section 5 lists what was verified as correct, because that matters as much as the defects.
The findings cluster in three places: **what the client is trusted to send** (C1, M10), **non-atomic
check-then-write counters** (M1–M6), and **gates that exist in `studia-api` but not in the database**
(H2, M10).

---

## 1. Critical

### C1 — Anyone with a Gmail address can create an *instructor* account — **FIXED**

> **Fixed by** `supabase/migrations/20260101000030_instructor_approval.sql` (instructors are inserted
> as `pending_approval`; `admin_users()`/`admin_user()` now report `Pending`),
> `studia-api/api/auth/complete-profile.ts` (`REQUIRE_INSTRUCTOR_APPROVAL = true`, closing the Google
> path), and the admin Users pages (Pending filter, Approve action). Students are unaffected, existing
> accounts are not migrated, and the mobile app needed no change — it already handled
> `ACCOUNT_PENDING`.

**Where:** `supabase/migrations/20260101000009_auth.sql:44-52` (`private.handle_new_user`)

```sql
v_role public.user_role := case meta ->> 'role'
         when 'instructor' then 'instructor'::public.user_role
         else 'student'::public.user_role end;  -- admin is never grantable via metadata
```

`meta` is `auth.users.raw_user_meta_data` — the `options.data` object the **client** passes to
`auth.signUp`. The comment is right that `admin` cannot be granted this way, but `instructor` can.

`studia-api/api/auth/register.ts` is not the only door to sign-up. The Supabase anon key is public
by design: it ships inside the APK and is committed in `studia-mobile/eas.json`. So anyone can call
the Supabase Auth REST endpoint directly:

```
POST https://<project>.supabase.co/auth/v1/signup
apikey: <anon key from the app bundle>

{ "email": "attacker@gmail.com", "password": "...",
  "data": { "role": "instructor", "full_name": "...", "department": "IT" } }
```

The only server-side gate on that path is `private.hook_before_user_created`
(`20260101000010_gmail_only.sql`), which checks **only** that the address ends in `@gmail.com`. The
attacker owns the mailbox, so email confirmation is no obstacle.

The resulting row has `status = 'active'` (table default) and `profile_completed = true` (for
password sign-ups), so the account is immediately usable. `REQUIRE_INSTRUCTOR_APPROVAL` in
`studia-api/api/auth/complete-profile.ts:37` is hard-coded `false` and, in any case, only covers the
Google flow through `studia-api` — it is not involved in a direct Auth sign-up.

**Impact.** A self-provisioned instructor can create classes, publish materials, create and grade
assessments, and post announcements. Combined with H1 below, they can harvest the email address and
phone number of every student who joins one of their classes. It also lets a student in a class
create a second, instructor-role identity.

**Fix (pick one, server-side):**

1. In `handle_new_user`, insert instructors as `status = 'pending_approval'` and let the admin
   approve them (`admin_set_user_active` already exists in migration 026). Students stay `active`.
2. Or stop trusting the metadata entirely: insert every new row as `role = 'student'` and have
   `studia-api` set `role = 'instructor'` with the service role after its own validation — the same
   pattern `complete-profile.ts` already uses, and which its own comment describes ("The client
   cannot write `role` itself (column grants), so this is the single place it is set").

Option 1 is the smaller change and also closes the gap on the Google path. Either way, the rule must
live in the database trigger or the Auth hook, not in `register.ts`.

---

## 2. High

### H1 — Any student can read every classmate's email address and phone number — **FIXED**

> **Fixed by** `supabase/migrations/20260101000031_classmate_name_privacy.sql` (drops
> `users_select_classmate`, adds `public.person_names(uuid[])`) and
> `studia-mobile/src/core/data/supabase/announcements-remote.ts` (comment author names come from that
> function instead of an embedded `users` join). The column grant is untouched, so the user's own
> profile read and the instructor's roster keep working.

**Where:** `supabase/migrations/20260101000008_rls_hardening.sql:99` +
`supabase/migrations/20260101000016_classmate_names.sql:17`

Migration 016 adds a row policy so a student can read the `users` row of anyone enrolled in the same
class:

```sql
create policy users_select_classmate on public.users for select to authenticated
  using (deleted_at is null and private.shares_class_with(id));
```

Its header comment says *"Column exposure is unchanged: RLS gates the row, and the app only selects
`full_name`."* That is the gap. RLS gates **rows**; which **columns** are readable is decided by the
grant in migration 008:

```sql
grant select (id, role, full_name, email, username, auth_provider, course, year_level, section,
              department, phone, status, last_active_at, created_at, updated_at)
  on public.users to authenticated;
```

A client is not obliged to select only `full_name`. Any signed-in student can run, with the anon key
and their own session:

```js
await supabase.from('users').select('full_name, email, phone, course, year_level, section');
```

and receive the full contact details of every classmate across all their classes. An instructor
(including a self-provisioned one, C1) gets the same for every student in their classes via
`users_select_teacher`.

**Impact.** Bulk PII disclosure — name, personal Gmail, mobile number, course/year/section — for a
student population that may include minors. This is the kind of exposure a data-protection complaint
is built on, and it needs no exploit, just a one-line query.

**Fix.** Narrow the **rows**, not the columns.

A column grant in Postgres is global to the role — it is not attached to a policy. So revoking
`email` and `phone` from `authenticated` would also break two reads that are legitimate:

- `studia-mobile/src/features/auth/data/remote-auth-service.ts:268` — the user's **own** profile read
  selects `email` and `phone` under `users_select_self`.
- `studia-mobile/src/features/instructor/data/students-remote.ts:14` — the instructor's student list
  selects `email` under `users_select_roster`.

The workable fix is to **drop the `users_select_classmate` policy** from migration 016 and serve the
one thing the app actually needs from it — a comment author's display name — through a
`SECURITY DEFINER` function, the way `public.class_classmates()` (`20260101000017:422`) and
`public.avatar_paths()` (migration 029) already do. `class_classmates` returns only `id, full_name`
and bypasses RLS, which is why the People tab needs no policy at all.

The only client change is `studia-mobile/src/core/data/supabase/announcements-remote.ts:37` and
`:137`, which embed `author:users!announcement_comments_author_id_fkey(full_name)` and currently rely
on that policy.

Separately decide whether an instructor should see their students' `email` and `phone`
(`users_select_roster` + the grant). That is arguably legitimate — contacting a student — and is a
product decision rather than a defect; this finding is about *classmates*, who have no such claim.

---

### H2 — "Forgot password" hands a working session to deactivated and unapproved accounts

**Where:** `studia-api/api/auth/otp-verify.ts:44`

```ts
if (purpose === "reset") {
  return { kind: "reset_token", session: toSessionDto(session) };
}
```

This returns **before** `assertAccountUsable(profile)` runs (line 59). Every other door checks the
account's status: password login (`login.ts:72`), OTP login and signup (`otp-verify.ts:59`), Google
(`google-start.ts:34`), and every `me/*` endpoint through `requireMe` (`me.ts:30`).

The object is named `reset_token`, but `toSessionDto` returns a real Supabase session — a valid
`accessToken` plus a `refreshToken`. The client holds it in memory
(`remote-auth-service.ts` `hold()`/`take()`), but the response body is the server's output: anyone
calling the API directly keeps both tokens.

**Impact.** An account an administrator deactivated (`status = 'inactive'` or `deleted_at` set), or
an instructor still `pending_approval`, can run the reset flow on their own mailbox and obtain a live
session. How much that session can do depends on RLS — and RLS is defended here:
`private.is_active_user()` (migration 008) gates `is_class_owner` / `is_class_member`, so class data
stays closed. But `users_select_self` is **not** status-gated, so the holder can still read their own
profile row, and they can call `/api/me/password-change` → `requireMe` → … which *does* re-check
status, so that is blocked. The practical result is a session that should not exist, protected only
by the fact that most things behind it happen to re-check. That is one missing check away from a real
bypass, and the deactivation promise ("This account has been deactivated") is already broken.

**Fix.** Call `assertAccountUsable(profile)` for the `reset` purpose too, revoking the session
(`revokeSession`) before throwing, exactly as the `google_signup` and `signup` branches do. Note that
the same reasoning applies to accounts in `pending_approval` — decide deliberately whether they may
reset a password.

---

### H3 — Accounts with an unverified email have no brute-force protection, and the API confirms when the password is right

**Where:** `studia-api/api/auth/login.ts:54-56`

```ts
if (error?.code === "email_not_confirmed") {
  throw new ApiError("EMAIL_NOT_VERIFIED", "Please verify your email to continue."); // password was right
}
```

Two problems, both from this branch returning before `await attempt(false, null)` on line 59:

1. **No attempt is recorded**, so the 5-failures-per-minute lockout in `checkLock` never engages.
   An attacker can guess passwords against an unverified account indefinitely at full speed.
2. **It is an oracle.** As the inline comment states, this response means the password was correct.
   A wrong password on the same account returns `INVALID_CREDENTIALS`. So the endpoint distinguishes
   "right password" from "wrong password" *and* confirms the account exists — the precise leak that
   `BAD_CREDENTIALS` was written to avoid ("One generic message for 'no such account' and 'wrong
   password' (no account enumeration)", line 64).

Unverified accounts exist in normal operation: every sign-up that stops before entering the emailed
code leaves one behind.

**Fix.** Record the attempt before throwing (`await attempt(false, null)`), and consider whether this
case should return the generic `INVALID_CREDENTIALS` instead. If the "please verify your email"
message is worth keeping for usability, it should at minimum be rate-limited identically to a failed
login.

---

### H4 — The admin portal has no second factor, and its refresh token is in `localStorage` despite the code saying otherwise

**Where:** `studia-admin/src/core/data/http/tokenStore.js:1-12` vs
`studia-admin/src/core/data/remote/remoteAuth.js:26-29`;
`studia-admin/src/features/auth/context/AuthContext.jsx:38-45`

**(a) The documented token-storage guarantee does not hold.** `tokenStore.js` opens with:

> *"the token lives in memory, and only a short 'session marker' is mirrored to localStorage"*

That is true of `tokenStore` itself. But `remoteAuth.login()` also calls
`getSupabase().auth.setSession(...)`, and that client is created with:

```js
auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
        storageKey: 'studia-admin-auth' }
```

`persistSession: true` writes the **access token and the long-lived refresh token** to
`localStorage` under `studia-admin-auth`. Every admin page needs that session — `remoteAdmin.rpc()`
runs as the admin — so this is not accidental, but it means an XSS on the admin origin yields
persistent admin access to the whole campus database, not a short-lived in-memory token. The comment
in `tokenStore.js` will mislead the next person who reasons about XSS impact.

**(b) There is no second factor.** `AuthContext.login` (line 38) sets the session as soon as
`api.login` returns, because `result.otpRequired` is never set — `studia-api/api/auth/login.ts`
returns `{ session, profile }` with no OTP step. `verifyLoginOtp` and `resendLoginOtp` in
`remoteAuth.js` both `throw fail(501, ...)`. So the single fixed admin account, which can read every
user's data and hard-delete users and classes (`admin_delete_users`), is protected by **one password**
— while *students* must pass an emailed code to change their own phone number
(`api/me/profile-update.ts`). The protection is inverted relative to the privilege.

Note that `docs/api-contract.md` specifies both admin OTP endpoints, and the UI scaffolding exists;
only the server half is missing.

**Fix.**
- Correct the `tokenStore.js` comment so it describes what actually happens, and keep the CSP tight
  (see M11 — it is currently not tight).
- Wire the admin OTP step, or enable a TOTP/WebAuthn factor through Supabase Auth for the admin
  account. Until then, treat the admin password as a single point of total compromise, and make sure
  it is long, unique, and not reused.

---

## 3. Medium

### M1 — The OTP wrong-attempt counter can be held at zero by sending guesses in parallel

**Where:** `studia-api/src/lib/auth-core.ts:157-162`

```ts
export async function registerWrongCode(db: Db, otp: ActiveOtp): Promise<never> {
  const next = afterWrongCode(otp.attempts);
  await db.from("otp_codes").update({ attempts: next.attempts }).eq("id", otp.id).eq("attempts", otp.attempts);
  if (next.locked) throw new ApiError("OTP_LOCKED", ...);
  throw new ApiError("OTP_INVALID", `Wrong code. ${next.left} ...`);
}
```

The comment above it reads *"Atomic-enough counter bump: the UPDATE is guarded by the previous value,
so parallel guesses cannot skip it."* The guard (`.eq("attempts", otp.attempts)`) does prevent a lost
update — but when it **matches zero rows the function does not notice**. The result of the `update`
is never inspected, and the function throws the same `OTP_INVALID` either way.

So with N concurrent `otp-verify` requests: all N read `attempts = 0` in `getActiveOtp`, all N
compute `next.attempts = 1`, one `UPDATE` wins and N−1 silently no-op. The counter advances by one
per *round* of parallel requests rather than once per guess. Enough concurrency turns the 5-attempt
cap into an effectively unbounded number of guesses against a 6-digit code within its 5-minute TTL.

**What limits this today:** Supabase Auth performs the actual code check and applies its own rate
limits, so this is not by itself a full OTP bypass — but the application-level cap this code exists to
provide does not hold, and the amount of protection left is whatever the Auth project settings
happen to be.

**Fix.** Make the bump atomic and authoritative. Either use a `SECURITY DEFINER` RPC doing
`update ... set attempts = attempts + 1 ... returning attempts`, and base the thrown error on the
returned value; or check `count` on the guarded update and re-read/retry when it is 0.

---

### M2 — The login lockout is a check-then-insert race

**Where:** `studia-api/src/lib/auth-core.ts:190-230` (`checkLock`, `recordAttempt`)

`checkLock` reads the last 20 attempts and decides; `recordAttempt` separately re-reads them and
computes `locked` for the row it is about to insert. Two unsynchronised round trips, no transaction,
no unique constraint, no `FOR UPDATE`.

Five simultaneous login attempts all read the same empty history, all compute
`failureTriggersLock(...) === false`, and all insert `locked = false`. The lock never arms. Because
each Vercel invocation is independent, parallelism is free.

Secondary issues in the same mechanism:

- The lock is keyed on `identifier` only, with no IP dimension, so anyone can lock a known user out
  for 60 s at will by sending five bad passwords (minor — the window is short by design).
- `LOGIN = { maxFails: 5, windowMs: 60_000, lockMs: 60_000 }` is a 60-second lock. Even when it
  works, it caps an attacker at roughly 5 guesses/minute/account, with no escalation.

**Fix.** Move the decision into one atomic statement — a `SECURITY DEFINER` RPC that inserts the
attempt and returns the resulting lock state in a single transaction, so the read and the write
cannot interleave.

---

### M3 — The AI per-hour quota is racy and only counts finished calls

**Where:** `studia-api/src/lib/ai-guard.ts:13-24`, and `logAi` call sites

`assertAiQuota` counts rows in `ai_requests` for the last hour; the row that represents *this* call is
only inserted by `logAi` **after** the provider responds (`chat.ts:72`, `summarize.ts:140`,
`quiz.ts:57`). Between the count and the insert the call is invisible to every other concurrent
request. A burst of parallel requests all see the same count and all pass.

This is a cost control on a shared free-tier API key, so bypassing it is a billing/availability
problem rather than a data one: one user can exhaust the campus-wide allowance.

**Fix.** Reserve before spending — insert a `status = 'pending'` row (or increment a counter) inside
the same statement that checks the limit, then update it with the outcome.

---

### M4 — Students can exceed the 3-regeneration cap on AI summaries

**Where:** `studia-api/src/ai/summarize.ts:120`

```ts
const regen = existing ? (isOwner ? existing.regen_count : existing.regen_count + 1) : 0;
```

`existing.regen_count` was read at line 65, well before the AI call (which takes seconds). The new
value is then written with an `upsert`, not an atomic increment. Two concurrent regenerate requests
both read `regen_count = 0`, both write `1`. The counter advances once for two spends.

The check at line 85 has the same staleness. The cap is a cost control, so the impact is quota
evasion rather than data exposure.

**Fix.** `regen_count = material_summaries.regen_count + 1` inside the `on conflict do update`
clause, or move the whole read-modify-write into an RPC.

---

### M5 — Regenerating a summary can destroy its objectives, or duplicate them

**Where:** `studia-api/src/ai/summarize.ts:135-139`

```ts
await db.from("material_objectives").delete().eq("material_id", materialId);
await db.from("material_objectives")
  .insert(parsed.objectives.map((body, position) => ({ material_id: materialId, position, body: ... })));
```

Two separate statements, no transaction, and **the insert's error is never checked** (unlike the
`upsert` three lines above, whose error is thrown). Consequences:

- If the insert fails — constraint violation, transient network error, function timeout between the
  two calls — the objectives are gone and the endpoint still returns `200` with the objectives in the
  body. The client shows them; the next read returns an empty list. Silent data loss.
- Two concurrent regenerations interleave as delete/delete/insert/insert, producing **two rows per
  `position`**. Nothing in migration 003 forbids it (no unique constraint on
  `(material_id, position)`), so the duplicates persist and the objectives list renders twice.

**Fix.** Do the replace in one RPC transaction, and check the insert's `error`. A unique constraint on
`(material_id, position)` would turn the duplicate case into a loud failure instead of silent
corruption.

---

### M6 — A quiz's time limit is never enforced, and the client supplies the start time

**Where:** `supabase/migrations/20260101000017_mobile_rpcs.sql:225-285` (`public.submit_quiz`)

`quizzes.time_limit_min` is written by `save_quiz` (line 306/318) and displayed by the app, but
`submit_quiz` never compares `now()` against `started_at + time_limit_min`. A student can open a
timed quiz, take as long as they like, and submit; the attempt is accepted and auto-scored.

Related: `p_started_at` is a client parameter, stored as
`least(coalesce(p_started_at, now()), now())` (line 241). The `least(..., now())` stops a student
claiming they started in the future, but any past timestamp is accepted. If a time limit is ever
enforced using the stored `started_at`, that enforcement will be bypassable by the same client that
is being limited.

**To be fair to the design:** the *deadline* rules (`due_at`, `allow_late`, `closes_at`) **are**
enforced server-side, by the `private.stamp_attempt_late` trigger in migration 011, which rejects
closed quizzes and stamps `late` from the database clock. The time limit is the one scheduling rule
that was left to the client.

**Fix.** In `submit_quiz`, when `q.time_limit_min is not null`, reject (or mark) an attempt whose
`started_at` is older than the limit; and derive `started_at` from the attempt row created when the
student *opened* the quiz rather than from a parameter.

---

### M7 — The answer key becomes readable while the student still has attempts left

**Where:** `supabase/migrations/20260101000008_rls_hardening.sql:38-48`
(`private.can_see_answer_key`)

```sql
and (coalesce(q.due_at < now(), false)
     or (select count(*) ... where submitted_at is not null) >= q.max_attempts)
```

The two conditions are OR-ed. The second is right: you see the key once you are out of attempts. The
first lets the key through as soon as `due_at` has passed, regardless of attempts remaining.

For a quiz with `max_attempts > 1` and `allow_late = true` (so attempts are still accepted after
`due_at`), a student can: submit attempt 1 after the due date → read every `correct_index` and
`correct_answer` via `quiz_question_keys` → submit attempt 2 with a perfect score. The attempt is
flagged `late` but fully scored.

This is narrow — it needs a multi-attempt quiz with a late window — but it is exactly the scenario the
file's own header promises against ("answer keys are revealed only once a student is finished with the
quiz").

**Fix.** Require both conditions for a quiz that still accepts attempts:
`attempts_used >= max_attempts or (q.due_at < now() and not <still accepting attempts>)`, where the
second clause reuses the closed-window logic from `stamp_attempt_late`.

---

### M8 — A known push token can be reassigned to another account

**Where:** `supabase/migrations/20260101000019_push_notifications.sql:26-31`

```sql
insert into public.push_tokens (token, user_id, platform, updated_at)
values (p_token, auth.uid(), p_platform, now())
on conflict (token) do update
  set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
```

The `on conflict` is deliberate and the comment explains why: *"a token can move between accounts on
a shared phone"*. The side effect is that **any** authenticated user who learns another device's Expo
push token can call `register_push_token` with it and claim it. From then on:

- The victim's phone receives the attacker's notifications (title and body are attacker-influenced
  content such as announcement text — a plausible phishing channel).
- The victim stops receiving their own, silently, with nothing in the UI to show why.

Expo push tokens are not credentials and not published, but they are not secrets either: they are
handled by client code and third-party services, and they appear in logs.

**Fix.** Bind the move to a proof of device possession, or at least delete the old row rather than
re-pointing it, and re-register from the device on each app launch (so a stolen registration
self-heals). Also validate `p_platform` in the function instead of relying on the table `CHECK`
(which surfaces as a raw constraint error), and cap rows per user.

---

### M9 — Admin-controlled settings JSON is validated on neither write nor read, and a bad value blocks the entire app

**Where:** `studia-mobile/src/core/logic/app-status.ts:40`,
`studia-mobile/src/core/logic/maintenance.ts:129`,
`supabase/migrations/20260101000027_app_status.sql:68-110` (`admin_save_settings`)

`refreshAppStatus` casts the RPC result without validating it:

```ts
if (data && typeof data === "object") {
  current = data as AppStatus;
```

This is the one network boundary in the mobile app that is **not** zod-validated — `auth-api.ts`
parses every auth response, and `AppStatus` is the shape that the root `AppGate` depends on.

`admin_save_settings` validates only string lengths, the `min_version` format (and only when
`required` is true), and the `download_url` scheme. The shape of `maintenance.roles`,
`maintenance.features`, `maintenance.scope` and `update.features` is never checked.
`public.app_status()` passes them through with `coalesce(v_m -> 'roles', '[]'::jsonb)` — which
defends against *missing*, not against *wrong type*.

So if `settings.system.maintenance.roles` is ever written as a string or an object instead of an
array, `m.roles.includes(role)` in `gateFor` throws a `TypeError`. `gateFor` is called from `AppGate`
at the root of the tree, so the failure is not local: **every user's app breaks at launch**, and it
cannot be fixed by an app update, only by correcting the settings row. The same applies to
`expand(m.features)`, which iterates `features` with `for...of`.

**Fix.** Validate the `AppStatus` payload with zod in `refreshAppStatus` and fall back to the last
known good value (the module is already written to fail open — `app-status.ts` says so explicitly).
Independently, validate the `system` and `legal` section shapes in `admin_save_settings`.

**Related, same function:** `insert ... on conflict do update set data = public.settings.data ||
excluded.data` is a **shallow** merge. A patch containing `{"system": {"maintenance": {"enabled":
true}}}` replaces the whole `maintenance` object, dropping `scope`, `roles`, `features`, `message`,
`starts_at` and `ends_at`. Whether that bites depends on what the admin UI sends; if it ever sends a
partial nested object, settings are silently lost.

---

### M10 — The emailed code protecting profile edits can be skipped entirely

**Where:** `supabase/migrations/20260101000001_identity.sql:95-98` vs
`studia-api/api/me/profile-update.ts`

`api/me/profile-update.ts` requires a 6-digit emailed code (`spendCode`) before changing a name,
phone, course, year or section. But the database grants those same columns directly to the user:

```sql
revoke update on public.users from authenticated, anon;
grant update (full_name, phone, course, year_level, section, department, last_active_at)
  on public.users to authenticated;
```

with `users_update_self` allowing the row. So a client holding its own session and the public anon key
can simply do:

```js
await supabase.from('users').update({ full_name: 'Prof. Reyes', section: 'A' }).eq('id', myId);
```

and the OTP step never happens. The column grant is doing exactly its intended job for *role*,
*status* and *email* (correctly withheld — see §5), but it also makes the OTP gate on the remaining
columns decorative.

**Impact.** Mostly integrity rather than confidentiality: self-service changes to the displayed name
(impersonating an instructor in a class stream or comment thread, which is where `full_name` is
shown — see migration 016) and to course/year/section, which drive class membership visibility and
analytics. It also means the audit story "profile changes are confirmed by email" is not true.

**Fix.** Decide which of the two mechanisms is the real one. If the OTP matters, revoke
`full_name, phone, course, year_level, section, department` from `authenticated` and route the edit
through `studia-api` (which holds the service role) or a `SECURITY DEFINER` RPC that requires a
consumed OTP. Keep `last_active_at` granted if the client updates it directly.

---

### M11 — Admin-portal CSP allows exfiltration to any host, and framing is not blocked

**Where:** `studia-admin/index.html:17-28`, `studia-admin/vercel.json`

```
connect-src 'self' http://localhost:* https:;
frame-ancestors 'none'
```

Two problems:

1. **`connect-src ... https:`** permits `fetch`/`XHR`/`WebSocket` to *any* HTTPS origin. Given H4
   (admin tokens in `localStorage`), the CSP provides no barrier to an injected script posting that
   token to an attacker's server. The directive needs to name the two origins the portal actually
   talks to — the Supabase project and `studia-api` — plus `http://localhost:*` for dev only.
2. **`frame-ancestors` is ignored in a `<meta>` tag.** The file's own comment says so
   ("frame-ancestors and some directives are ignored in a meta tag"), and `vercel.json` sets no
   headers at all — only `rewrites`. So in production there is nothing stopping the portal being
   framed: no effective `frame-ancestors` and no `X-Frame-Options`. Clickjacking against admin
   actions such as `admin_delete_users` is possible.

**Fix.** Move the CSP into real response headers via `vercel.json`'s `headers` array, tighten
`connect-src` to the two known origins, and add `X-Frame-Options: DENY` (or rely on the
now-effective `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff` and
`Strict-Transport-Security`.

---

## 4. Low

| # | Finding | Where |
|---|---|---|
| L1 | **Spoofable client IP in audit records.** `clientIp` takes the *leftmost* `X-Forwarded-For` value, which is attacker-supplied; Vercel appends the real IP to the right. The value is written to `otp_codes.request_ip`, `login_attempts.ip` and `audit_log.ip`, so an attacker can forge the IP in the admin's security views and in login-attempt forensics. Not used for rate limiting, so impact is limited to audit integrity. Prefer Vercel's `x-vercel-forwarded-for`, or take the rightmost hop. | `studia-api/src/lib/http.ts:60-64` |
| L2 | **Account enumeration via sign-up.** `register.ts` returns `EMAIL_TAKEN` ("This email is already registered"), which contradicts the deliberate anti-enumeration in `login.ts` and in the `reset` branch of `otp-send.ts`. The code acknowledges the trade-off ("the spec asks us to tell the user it is taken"). If that is a product decision, fine — but note the inconsistency so it is not mistaken for protection. | `studia-api/api/auth/register.ts:60,78` |
| L3 | **Gmail aliasing defeats per-email throttles.** `normalizeEmail` only lowercases and trims; Gmail ignores dots and `+tags`, so `a.b@gmail.com`, `ab@gmail.com` and `ab+x@gmail.com` are one mailbox but three distinct keys. That multiplies the OTP hourly cap (`assertCanSendOtp` keys on `email`), sidesteps the login lockout (keyed on `identifier`), and allows several accounts per real mailbox (`uq_users_email` is on the literal string). | `studia-api/src/lib/policy.ts:11-13` |
| L4 | **AI chat trusts client-supplied history.** `history` (up to 12 turns, 4000 chars each) is injected as prior `assistant`/`user` messages, so the caller can forge what "the AI already said" and steer it past its system rules. Impact is bounded — users mostly jailbreak themselves — but the forged exchange is then persisted to `ai_chat_messages`. The `insert` on line 78 also has its `error` unchecked, so a failed write silently loses the thread. | `studia-api/src/ai/chat.ts:48,78` |
| L5 | **`send-push` can crash on an unexpected Expo response.** `tokens[i].token` assumes the ticket array is the same length and order as the token array; a shorter array yields `undefined.token` → `TypeError` → the whole push for that notification fails. There is also no chunking (Expo caps a request at 100 messages) and no retry: `pg_net` fires the webhook with a 3 s timeout and ignores the outcome, so a failed push is logged to the function console and lost. | `supabase/functions/send-push/index.ts:56` |
| L6 | **Unbounded email fan-out.** A campus announcement inserts one `notifications` row per user, each triggering one `send-push` invocation that sends one Gmail SMTP message. Gmail's sending limits (hundreds/day) will be hit by a campus-wide announcement, and failures are swallowed by `Promise.allSettled`. Partial delivery will look like success. | `supabase/functions/send-push/index.ts:64-88`, `20260101000022` |
| L7 | **Concurrent `complete-profile` returns a 500.** The `.eq("profile_completed", false)` guard makes the operation single-use (good), but on the losing call `.single()` returns a PostgREST "no rows" error that is re-thrown raw, so the user sees "Something went wrong" instead of the intended `EMAIL_TAKEN`. Check for that error code and throw the typed one. | `studia-api/api/auth/complete-profile.ts:62-70` |
| L8 | **Grading errors surface as raw constraint violations.** `grade_assignment` and `grade_quiz_attempt` pass `p_score` straight through; the bounds are enforced by `private.check_submission_score` and the `score <= max_score` CHECK, which raise SQLSTATE 23514. `remoteAdmin.toError` has no case for 23514, so the instructor sees a generic failure rather than "score exceeds the maximum". Validate in the RPC and raise a typed error. | `20260101000017:210`, `20260101000004:66` |
| L9 | **Submit/grade TOCTOU on assignments.** `submit_assignment` reads the submission, decides it is not graded, then upserts; the `on conflict do update` does not re-check `status` or clear `score`. If an instructor's `grade_assignment` commits in between, the row ends up `status = 'submitted'` with a score and `graded_at` still set, and the student's edit lands after grading. Narrow window, but the "already graded" guard is not airtight. | `20260101000020_edit_submission.sql:24-40` |
| L10 | **Avatar storage can leak orphans.** The happy path is careful (upload → update row → delete old, with a compensating delete if the row update fails), but `remove([profile.avatar_path])` is `.catch(() => undefined)`, so a failed deletion leaves the old object in the bucket with nothing referencing it. There is also no per-user upload quota, so repeated uploads consume storage. Low impact; worth a periodic sweep. | `studia-api/api/me/avatar.ts:60-72` |
| L11 | **`app_status()` is anonymous and polled by every client every 60 s.** It is `grant execute ... to anon`, uncached, and runs two `settings` reads plus timestamp parsing per call. It exposes no user data (verified), but it is a free, unauthenticated lever on database load that grows linearly with installs. Consider caching the result client-side for longer, or putting it behind an edge cache. | `20260101000027_app_status.sql:60-61`, `studia-mobile/src/core/logic/app-status.ts:18` |
| L12 | **Webhook secret comparison leaks its length.** `sameSecret` returns early when lengths differ, before the constant-time loop. Length is not very useful to an attacker, but the fix is one line: compare fixed-length digests instead. | `supabase/functions/send-push/index.ts:23-28` |
| L13 | **Session writes to SecureStore are not atomic.** `setItem` deletes the old chunks, writes N new ones, then writes the count. A crash mid-write leaves an inconsistent set; `getItem` handles it by returning `null` ("torn write: treat as signed out"), which degrades safely but silently signs the user out. Acceptable; writing the count first under a new key and swapping would avoid it. | `studia-mobile/src/core/data/supabase/secure-storage.ts:32-42` |
| L14 | **Unset `ALLOWED_ORIGINS` fails silently.** `cors()` emits no headers when the origin is not in the list, and `allowedOrigins()` returns `[]` when the variable is missing (unlike `need()`, which throws for the other three). The native app sends no `Origin` and is unaffected, so a misconfiguration would show up only as the admin portal's browser requests failing with an opaque CORS error. Log a warning at startup when the list is empty. | `studia-api/src/lib/env.ts:13-18`, `http.ts:46-54` |

---

## 5. What was verified as correct

These were checked specifically because they are the usual failure points. Recording them so nobody
re-audits them, and so a future change that breaks one is recognisable as a regression.

**Authorization architecture**

- **All 32 `admin_*` RPCs call `private.assert_admin()`** (migrations 025, 026, 028 — checked
  mechanically, every one). The dynamic grant loop at `025:656-660` revokes execute from `public` and
  `anon` and grants only to `authenticated`, so the in-function check is the whole boundary — and it
  is present everywhere.
- **No permissive policies.** Zero `USING (true)` policies across all 29 migrations.
- **Every `SECURITY DEFINER` function pins `set search_path = ''`** (130 `search_path` clauses for 120
  definer declarations). This closes the classic Postgres definer-function hijack.
- **`anon` holds no table privileges** and cannot reach the `private` schema (`008:12-17`).
- **Column-level grants block self-escalation.** `role`, `status`, `email`, `deleted_at`,
  `failed_login_count`, `locked_until` are all withheld from `authenticated` (`001:95-99`,
  `008:97-99`), so a user cannot promote themselves or reactivate a disabled account. `score`,
  `graded_at`, `submitted_at` are likewise withheld on submissions and attempts.
- **`private.is_active_user()` gates class access**, so deactivation takes effect immediately rather
  than when the JWT expires (`008:20-23` — the motivation for H2's severity being High rather than
  Critical).
- **Answer keys live in their own table** (`quiz_question_keys`) with their own policy, so a student
  reading questions cannot read the key — the structural decision is right, M7 is only about the
  timing predicate.
- **`private.owns_file()` is enforced on submission insert *and* update policies** (`008:107-119`).
  Without it a student could point their own draft at another student's `file_id` and gain read access
  through `can_read_file`. This was specifically checked and is closed.
- **The quiz attempt-count race is contained.** `submit_quiz` does a non-atomic
  `count` → `insert attempt_no = n + 1` (`017:235-241`), which is racy in principle, but
  `unique (quiz_id, student_id, attempt_no)` plus the `check_attempt_limit` trigger make the loser
  fail rather than over-award an attempt. This is the pattern M1–M4 should follow.
- **Avatar visibility** (`029`) is scoped to classmates, one's own instructor and one's own students,
  with the bucket private and paths never returned to people who may not see them.

**Authentication**

- **Google sign-in is verified server-side.** The native ID token goes to `studia-api`, which
  exchanges it with Supabase, **throws the resulting session away** (`google-start.ts:28`), and emails
  a code — so the OTP is a genuine second factor rather than a formality, and the client never holds a
  session it did not earn.
- **Role and status are checked before any email is sent** on the Google login path
  (`google-start.ts:34`).
- **`admin` is not grantable through user metadata** (`009:44`) — the one escalation that would be
  catastrophic is blocked (C1 is about `instructor`).
- **Password reset does not enumerate accounts**: the `reset` branch of `otp-send.ts` returns the same
  response for unknown addresses, creates a decoy counter row so a later verify fails identically, and
  swallows `RATE_LIMITED` so timing does not differ.
- **Mobile tokens are in `expo-secure-store`** (Keychain/Keystore), never `AsyncStorage`, with
  chunking for the 2 KB value limit.
- **Sign-out purges caches.** `core/logic/sign-out.ts` is the single exit path and clears the query
  cache, the notification stream and the image disk cache, so the next account on a shared phone does
  not see the previous one's data. `endRemoteSession` is documented and written to never throw.

**API surface**

- **Bearer tokens only, no cookies** → no CSRF surface, which is why the loose CORS configuration in
  L14 is not itself a vulnerability.
- **Every endpoint is POST-only, zod-validated**, with a typed error union and a generic 500 that
  never leaks internals. Logging is deliberately minimal: `console.error("[auth]", e.name)` — no
  bodies, emails or codes; the AI client logs provider status codes only.
- **The user id always comes from the verified token**, never from the body (`me.ts:21-31`), and
  `summarize.ts` re-checks class access with the service role rather than trusting the material id's
  provenance.
- **Avatar uploads are type-sniffed from magic bytes**, size-capped at 2 MB, stored under
  `<user id>/<uuid>` in a private bucket, and returned only as short-lived signed URLs.
- **No dynamic SQL in any user-reachable path** — the only two `execute format()` calls operate on a
  hard-coded list of function names at migration time.
- **No `innerHTML` / `dangerouslySetInnerHTML` in the admin portal**; the legal-text editor uses a
  plain `<textarea>`, and `send-push` HTML-escapes every interpolated value.
- **AI prompts carry anti-injection instructions** and treat transcripts and topics as data
  (`summarize.ts:38`, `quiz.ts:35`).

**Secrets hygiene**

- The service-role key appears only as an **environment variable name**; no key material is committed
  anywhere (`git grep` over the whole tree).
- `.env`, `.env.*` and `*.local` are correctly ignored, including `studia-admin/env.local`
  (verified with `git check-ignore`); the working tree has no untracked secret files.
- The Supabase **anon** key and Google client IDs in `eas.json` are public by design — that is
  correct, and C1/H1/M10 are about not relying on them being secret.

---

## 6. Suggested order of work

1. **C1** — close the instructor self-provisioning path. One change in `handle_new_user`. Everything
   else assumes roles mean something.
2. **H1** — stop granting `email`/`phone` to classmates. Also one change, and it is the finding most
   likely to matter outside the codebase.
3. **H2, H3** — two missing calls in the auth endpoints (`assertAccountUsable` for `reset`,
   `attempt(false)` before the `EMAIL_NOT_VERIFIED` throw).
4. **M9** — zod-validate `app_status()` in the client. Cheap, and it removes a way for one bad
   settings write to brick every installed app.
5. **H4, M11** — admin hardening: fix the misleading `tokenStore` comment, tighten `connect-src`, move
   the CSP to real headers, add `X-Frame-Options`, and plan the admin second factor.
6. **M1, M2** — the two auth counters, as atomic RPCs. M3/M4 can follow the same pattern.
7. **M10, M6, M7, M5, M8** — rule-enforcement gaps, in whatever order suits the release.
8. The Low table as maintenance, with **L5** first (it is the one that can throw at runtime).

## 7. One structural suggestion

Most Medium findings share a single cause: **a rule is enforced in `studia-api` but not in the
database, while both doors are open to clients.** `studia-api` holds the service role and can be
trusted; the mobile app holds the public anon key and cannot, yet it can reach PostgREST directly for
anything RLS and column grants allow. H2, M6 and M10 are all instances of this, and C1 is the extreme
case.

A useful rule of thumb for future work: **if a constraint matters, it belongs in the database** — a
policy, a column grant, a `CHECK`, or a `SECURITY DEFINER` RPC that is the only granted path. Treat
`studia-api` as the place for things the database genuinely cannot do (talking to Supabase Auth,
calling the AI provider, sending mail) rather than as a gate, because it is not the only way in.

Migration 008 is the model here: it went looking for exactly this class of gap and closed several
(`owns_file` on submissions, answer-key timing, `is_active_user` on class access, admin's direct data
access). The findings above are the ones that pass missed, or that later migrations reopened.

---

*Static review only. No code was modified and no runtime testing was performed. Findings that depend
on configuration outside the repository are marked as such.*
