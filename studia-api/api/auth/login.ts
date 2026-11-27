// Password login for students, instructors and the admin portal.
// Lockout (5 failures / 1 min) lives here, backed by public.login_attempts.
//
// Students and instructors: a correct password returns a session.
// Admin: a correct password returns { otpRequired } and emails a 6-digit code; the session comes from
// otp-verify with purpose "admin_login". Migrations 036 and 037.
import { z } from "zod";
import { adminClient, anonClient, type Db } from "../../src/lib/clients.js";
import { ApiError, clientIp, endpoint } from "../../src/lib/http.js";
import {
  assertAccountUsable,
  assertCanSendOtp,
  checkLock,
  getProfile,
  recordAttempt,
  recordOtpSent,
  revokeSession,
  toProfileDto,
  toSessionDto,
  type Profile,
  type PublicRole,
} from "../../src/lib/auth-core.js";
import { normalizeEmail } from "../../src/lib/policy.js";
import { env } from "../../src/lib/env.js";

const Body = z.object({
  identifier: z.string().min(1).max(254).transform(normalizeEmail),
  password: z.string().min(1).max(128),
  role: z.enum(["student", "instructor", "admin"]),
});

const BAD_CREDENTIALS = "Incorrect email or password";

async function resolveEmail(db: Db, identifier: string, role: PublicRole): Promise<string | null> {
  if (identifier.includes("@")) return identifier;
  if (role !== "admin") return null;
  const { data } = await db.from("users").select("email").eq("username", identifier).eq("role", "admin").maybeSingle();
  return data?.email ?? null;
}

async function auditAdmin(db: Db, p: Profile, summary: string, ip: string | null): Promise<void> {
  await db.from("audit_log").insert({ actor_id: p.id, actor_name: p.full_name, action: "security", summary, ip });
}

export default endpoint(Body, async ({ identifier, password, role }, req) => {
  const db = adminClient();
  const ip = clientIp(req);
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
  const attempt = (success: boolean, userId: string | null) =>
    recordAttempt(db, { identifier, success, role, userId, ip, userAgent });

  await checkLock(db, identifier);

  const email = await resolveEmail(db, identifier, role);
  const { data, error } = email
    ? await anonClient().auth.signInWithPassword({ email, password })
    : { data: null, error: { code: "invalid_credentials", status: 400 } };

  if (error || !data?.session || !data.user) {
    if (error?.code === "email_not_confirmed") {
      // The password WAS right, so this answer distinguishes a correct guess from a wrong one. Count
      // it like any other failed sign-in, or an unverified account would have no lockout at all and
      // the endpoint would work as a password oracle.
      await attempt(false, null);
      throw new ApiError("EMAIL_NOT_VERIFIED", "Please verify your email to continue.");
    }
    if (error?.code === "invalid_credentials" || error?.status === 400) {
      await attempt(false, null);
      // One generic message for "no such account" and "wrong password" (no account enumeration).
      throw new ApiError("INVALID_CREDENTIALS", BAD_CREDENTIALS);
    }
    if (error?.code === "user_banned") {
      // admin_set_user_active() (026) sets banned_until as well as status = 'inactive', so a
      // deactivated account never reaches the profile-status check below -- GoTrue rejects the
      // sign-in itself. Same oracle reasoning as email_not_confirmed: the password WAS right.
      await attempt(false, null);
      throw new ApiError("ACCOUNT_INACTIVE", "This account is deactivated");
    }
    throw error ?? new Error("login failed");
  }

  const session = data.session;
  const profile = await getProfile(db, data.user.id);
  try {
    if (!profile) throw new ApiError("INVALID_CREDENTIALS", BAD_CREDENTIALS);
    assertAccountUsable(profile, role);
  } catch (e) {
    await revokeSession(db, session.access_token);
    await attempt(false, profile?.id ?? null);
    if (role === "admin" && profile) {
      await auditAdmin(db, profile, "Rejected admin sign-in (account is not an active administrator)", ip);
    }
    throw e;
  }

  // The admin's password buys a code, not a session. Everything this account can do -- reading every
  // user's data, hard-deleting users and classes -- was behind one password, while a student needed an
  // emailed code to change their own phone number. The session Supabase just minted is thrown away;
  // the client receives one only after otp-verify accepts the code (purpose "admin_login"), the same
  // shape as Google sign-in uses in google-start.ts.
  // env.adminOtpEnabled() is the escape hatch: ADMIN_OTP=off falls through to the password-only path
  // below, for when the sign-in code cannot be delivered and nobody can reach the portal.
  if (role === "admin" && env.adminOtpEnabled()) {
    await revokeSession(db, session.access_token);
    await Promise.all([
      attempt(true, profile.id),
      auditAdmin(db, profile, "Administrator password accepted; sign-in code sent", ip),
    ]);
    await assertCanSendOtp(db, email!, "admin_login");
    const { error: sendErr } = await anonClient().auth.signInWithOtp({ email: email!, options: { shouldCreateUser: false } });
    if (sendErr) throw sendErr;
    const info = await recordOtpSent(db, email!, "admin_login", ip);
    return {
      otpRequired: true,
      pendingToken: email, // the address the code went to, echoed back for step two -- not a secret
      maskedEmail: maskEmail(email!),
      expiresInSec: info.expiresInSec,
      resendInSec: info.resendInSec,
    };
  }

  // Independent bookkeeping writes: run together (each was a separate round trip to the database).
  await Promise.all([
    attempt(true, profile.id),
    db.from("users").update({ last_active_at: new Date().toISOString() }).eq("id", profile.id),
    // Only reachable for an admin with ADMIN_OTP=off; say so in the audit trail rather than record
    // the same "Administrator signed in" as a two-factor sign-in.
    role === "admin" ? auditAdmin(db, profile, "Administrator signed in (sign-in code disabled)", ip) : Promise.resolve(),
  ]);

  return { session: toSessionDto(session), profile: toProfileDto(profile, data.user) };
});

/** "ad•••@gmail.com" — enough for the admin to recognise the inbox, not enough to publish it. */
function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  const head = name.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, name.length - head.length))}@${domain}`;
}
