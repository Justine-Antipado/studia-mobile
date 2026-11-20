// Shared server logic for the auth endpoints: profiles, status gates, OTP counters, login attempts.
import type { Session, User } from "@supabase/supabase-js";
import type { Database } from "../../../shared-types/database.types.js";
import type { Db } from "./clients.js";
import { ApiError } from "./http.js";
import { LOGIN, OTP, afterWrongCode, failureTriggersLock, lockState, resendWaitSec, type Attempt } from "./policy.js";

export type Profile = Database["public"]["Tables"]["users"]["Row"];
export type OtpPurpose = Database["public"]["Enums"]["otp_purpose"];
export type PublicRole = "student" | "instructor" | "admin";

export type OtpInfoDto = { email: string; resendInSec: number; expiresInSec: number };
export type SessionDto = { accessToken: string; refreshToken: string; expiresAt: number };
export type ProfileDto = {
  id: string;
  role: Profile["role"];
  fullName: string;
  email: string;
  course: string | null;
  year: string | null;
  section: string | null;
  department: string | null;
  phone: string | null;
  authProvider: Profile["auth_provider"];
  emailVerified: boolean;
  status: Profile["status"];
  createdAt: string;
};

export const toSessionDto = (s: Session): SessionDto => ({
  accessToken: s.access_token,
  refreshToken: s.refresh_token,
  expiresAt: (s.expires_at ?? Math.floor(Date.now() / 1000) + s.expires_in) * 1000,
});

export const toProfileDto = (p: Profile, user?: User): ProfileDto => ({
  id: p.id,
  role: p.role,
  fullName: p.full_name,
  email: p.email,
  course: p.course,
  year: p.year_level,
  section: p.section,
  department: p.department,
  phone: p.phone,
  authProvider: p.auth_provider,
  emailVerified: user ? !!user.email_confirmed_at : true,
  status: p.status,
  createdAt: p.created_at,
});

export async function getProfile(db: Db, id: string): Promise<Profile | null> {
  const { data, error } = await db.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProfileByEmail(db: Db, email: string): Promise<Profile | null> {
  const { data, error } = await db.from("users").select("*").eq("email", email).maybeSingle();
  if (error) throw error;
  return data;
}

/** Revokes exactly this session (other devices stay signed in). */
export async function revokeSession(db: Db, accessToken: string): Promise<void> {
  await db.auth.admin.signOut(accessToken, "local").catch(() => undefined);
}

/** Status/role gates shared by password login, OTP login and Google login. */
export function assertAccountUsable(p: Profile, wanted?: PublicRole): void {
  if (wanted && p.role !== wanted) {
    const label = p.role === "admin" ? "an administrator" : p.role;
    throw new ApiError(
      "ROLE_MISMATCH",
      wanted === "admin"
        ? "This portal is for administrators only."
        : `This account is registered as ${label}. Go back and choose ${p.role}.`,
    );
  }
  if (p.deleted_at || p.status === "inactive") {
    throw new ApiError("ACCOUNT_INACTIVE", "This account has been deactivated. Contact the administrator.");
  }
  if (p.status === "pending_approval") {
    throw new ApiError("ACCOUNT_PENDING", "Your instructor account is waiting for administrator approval.");
  }
}

/* ---------- OTP counters ---------- */

const isoAgo = (ms: number): string => new Date(Date.now() - ms).toISOString();

/** Throws RATE_LIMITED when the 30 s resend gap or the hourly cap is hit. Does not send anything. */
export async function assertCanSendOtp(db: Db, email: string, purpose: OtpPurpose): Promise<void> {
  const { data: last, error } = await db
    .from("otp_codes")
    .select("sent_at")
    .eq("email", email)
    .eq("purpose", purpose)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const wait = resendWaitSec(last ? Date.parse(last.sent_at) : null, Date.now());
  if (wait > 0) {
    throw new ApiError("RATE_LIMITED", `Please wait ${wait}s before requesting another code.`, { retryAfterSec: wait });
  }
  const { count, error: e2 } = await db
    .from("otp_codes")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("sent_at", isoAgo(3_600_000));
  if (e2) throw e2;
  if ((count ?? 0) >= OTP.maxPerHour) {
    throw new ApiError("RATE_LIMITED", "Too many codes requested. Try again later.", { retryAfterSec: 600 });
  }
}

export async function recordOtpSent(db: Db, email: string, purpose: OtpPurpose, ip: string | null): Promise<OtpInfoDto> {
  const now = Date.now();
  const { error } = await db.from("otp_codes").insert({
    email,
    purpose,
    attempts: 0,
    sent_at: new Date(now).toISOString(),
    expires_at: new Date(now + OTP.ttlSec * 1000).toISOString(),
    request_ip: ip,
  });
  if (error) throw error;
  return { email, resendInSec: OTP.resendSec, expiresInSec: OTP.ttlSec };
}

export type ActiveOtp = { id: string; attempts: number };

/** Latest live code row; throws OTP_EXPIRED / OTP_LOCKED exactly like the mock. */
export async function getActiveOtp(db: Db, email: string, purpose: OtpPurpose): Promise<ActiveOtp> {
  const { data, error } = await db
    .from("otp_codes")
    .select("id, attempts, expires_at")
    .eq("email", email)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError("OTP_EXPIRED", "No active code. Request a new one.");
  if (Date.parse(data.expires_at) <= Date.now()) {
    throw new ApiError("OTP_EXPIRED", "This code has expired. Request a new one.");
  }
  if (data.attempts >= OTP.maxAttempts) {
    throw new ApiError("OTP_LOCKED", "Too many wrong codes. Request a new one.");
  }
  return { id: data.id, attempts: data.attempts };
}

/** Atomic-enough counter bump: the UPDATE is guarded by the previous value, so parallel guesses cannot skip it. */
export async function registerWrongCode(db: Db, otp: ActiveOtp): Promise<never> {
  const next = afterWrongCode(otp.attempts);
  await db.from("otp_codes").update({ attempts: next.attempts }).eq("id", otp.id).eq("attempts", otp.attempts);
  if (next.locked) throw new ApiError("OTP_LOCKED", "Too many wrong codes. Request a new one.");
  throw new ApiError("OTP_INVALID", `Wrong code. ${next.left} ${next.left === 1 ? "attempt" : "attempts"} left.`);
}

export async function consumeOtp(db: Db, otp: ActiveOtp): Promise<void> {
  await db.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
}

/** For google_* resends: the flow must have been started by google-start in the last 15 minutes. */
export async function assertGoogleFlowStarted(db: Db, email: string, purpose: OtpPurpose): Promise<void> {
  const { data, error } = await db
    .from("otp_codes")
    .select("id")
    .eq("email", email)
    .eq("purpose", purpose)
    .gte("sent_at", isoAgo(15 * 60_000))
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError("OTP_EXPIRED", "This session expired. Please start again.");
}

/* ---------- login attempts (lockout) ---------- */

export async function checkLock(db: Db, identifier: string): Promise<void> {
  const { data, error } = await db
    .from("login_attempts")
    .select("success, locked, attempted_at")
    .eq("identifier", identifier)
    .gte("attempted_at", isoAgo(LOGIN.windowMs))
    .order("attempted_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  const recent: Attempt[] = (data ?? []).map((r) => ({ success: r.success, locked: r.locked, at: Date.parse(r.attempted_at) }));
  const state = lockState(recent, Date.now());
  if (state.locked) {
    throw new ApiError("RATE_LIMITED", `Too many attempts. Try again in ${state.retryAfterSec}s.`, {
      retryAfterSec: state.retryAfterSec,
    });
  }
}

export async function recordAttempt(
  db: Db,
  a: { identifier: string; success: boolean; role: PublicRole | null; userId: string | null; ip: string | null; userAgent: string | null },
): Promise<void> {
  let locked = false;
  if (!a.success) {
    const { data } = await db
      .from("login_attempts")
      .select("success, locked, attempted_at")
      .eq("identifier", a.identifier)
      .gte("attempted_at", isoAgo(LOGIN.windowMs))
      .order("attempted_at", { ascending: false })
      .limit(20);
    const recent: Attempt[] = (data ?? []).map((r) => ({ success: r.success, locked: r.locked, at: Date.parse(r.attempted_at) }));
    locked = failureTriggersLock(recent, Date.now());
  }
  await db.from("login_attempts").insert({
    identifier: a.identifier,
    success: a.success,
    locked,
    role: a.role,
    user_id: a.userId,
    ip: a.ip,
    user_agent: a.userAgent?.slice(0, 255) ?? null,
  });
}
