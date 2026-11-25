// Verify a code. Attempts are counted here (max 5 per code); Supabase Auth checks the code itself.
import { z } from "zod";
import { adminClient, anonClient, untyped } from "../../src/lib/clients.js";
import { ApiError, clientIp, endpoint } from "../../src/lib/http.js";
import {
  assertAccountUsable,
  consumeOtp,
  getActiveOtp,
  getProfile,
  registerWrongCode,
  revokeSession,
  toProfileDto,
  toSessionDto,
} from "../../src/lib/auth-core.js";
import { normalizeEmail } from "../../src/lib/policy.js";

const Body = z.object({
  email: z.string().max(254).transform(normalizeEmail),
  purpose: z.enum(["signup", "reset", "google_login", "google_signup", "admin_login"]),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

const AUTH_TYPE = {
  signup: "signup",
  reset: "recovery",
  google_login: "email",
  google_signup: "email",
  admin_login: "email",
} as const;

export default endpoint(Body, async ({ email, purpose, code }, req) => {
  const db = adminClient();
  const otp = await getActiveOtp(db, email, purpose);

  const { data, error } = await anonClient().auth.verifyOtp({ email, token: code, type: AUTH_TYPE[purpose] });
  if (error || !data.session || !data.user) {
    if (error && (error.status ?? 0) >= 500) throw error;
    return registerWrongCode(db, otp); // always throws OTP_INVALID or OTP_LOCKED
  }
  await consumeOtp(db, otp);

  const session = data.session;
  const profile = await getProfile(db, data.user.id);
  if (!profile) {
    await revokeSession(db, session.access_token);
    throw new ApiError("OTP_EXPIRED", "This session expired. Please start again.");
  }

  if (purpose === "reset") {
    // A reset session is a real session, so it answers to the same status gate as every other door:
    // a deactivated or not-yet-approved account must not leave here holding tokens.
    try {
      assertAccountUsable(profile);
    } catch (e) {
      await revokeSession(db, session.access_token);
      throw e;
    }
    return { kind: "reset_token", session: toSessionDto(session) };
  }
  if (purpose === "google_signup") {
    if (profile.profile_completed) {
      await revokeSession(db, session.access_token);
      throw new ApiError("EMAIL_TAKEN", "An account with this email already exists.");
    }
    return { kind: "needs_profile", fullName: profile.full_name, session: toSessionDto(session) };
  }

  try {
    // signup + google_login: role was checked before the code was sent. admin_login insists on the
    // role again here, so the purpose cannot be borrowed by a student who got a code some other way.
    assertAccountUsable(profile, purpose === "admin_login" ? "admin" : undefined);
  } catch (e) {
    await revokeSession(db, session.access_token);
    throw e;
  }

  if (purpose === "admin_login") {
    // Only now is anyone actually signed in; login.ts recorded the password step separately.
    await untyped(db).rpc("audit_admin_event", {
      p_admin: profile.id,
      p_summary: "Administrator signed in (code verified)",
      p_ip: clientIp(req),
    });
  }
  await db.from("users").update({ last_active_at: new Date().toISOString() }).eq("id", profile.id);
  return { kind: "session", session: toSessionDto(session), profile: toProfileDto(profile, data.user) };
});
