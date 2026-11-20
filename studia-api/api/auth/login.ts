// Password login for students, instructors and the admin portal.
// Lockout (5 failures / 1 min) lives here, backed by public.login_attempts.
import { z } from "zod";
import { adminClient, anonClient, type Db } from "../../src/lib/clients.js";
import { ApiError, clientIp, endpoint } from "../../src/lib/http.js";
import {
  assertAccountUsable,
  checkLock,
  getProfile,
  recordAttempt,
  revokeSession,
  toProfileDto,
  toSessionDto,
  type Profile,
  type PublicRole,
} from "../../src/lib/auth-core.js";
import { normalizeEmail } from "../../src/lib/policy.js";

const Body = z.object({
  identifier: z.string().min(1).max(254).transform(normalizeEmail),
  password: z.string().min(1).max(128),
  role: z.enum(["student", "instructor", "admin"]),
});

const BAD_CREDENTIALS =
  "Incorrect email or password. If you signed up with Google, use “Continue with Google”.";

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
      throw new ApiError("EMAIL_NOT_VERIFIED", "Please verify your email to continue."); // password was right
    }
    if (error?.code === "invalid_credentials" || error?.status === 400) {
      await attempt(false, null);
      // One generic message for "no such account" and "wrong password" (no account enumeration).
      throw new ApiError("INVALID_CREDENTIALS", BAD_CREDENTIALS);
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

  // Independent bookkeeping writes: run together (each was a separate round trip to the database).
  await Promise.all([
    attempt(true, profile.id),
    db.from("users").update({ last_active_at: new Date().toISOString() }).eq("id", profile.id),
    role === "admin" ? auditAdmin(db, profile, "Administrator signed in", ip) : Promise.resolve(),
  ]);

  return { session: toSessionDto(session), profile: toProfileDto(profile, data.user) };
});
