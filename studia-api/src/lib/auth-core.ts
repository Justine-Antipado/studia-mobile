// Shared server logic for the auth endpoints: profiles, status gates, OTP counters, login attempts.
import type { Session, User } from "@supabase/supabase-js";
import type { Database } from "../../../shared-types/database.types.js";
import { untyped, type Db } from "./clients.js";
import { ApiError } from "./http.js";
// The lockout and attempt arithmetic now lives in migration 032 (one statement per decision);
// policy.ts keeps the pure versions, which its unit tests cover.
import { OTP, throttleKey } from "./policy.js";

export type Profile = Database["public"]["Tables"]["users"]["Row"];
// `admin_login` comes from migration 036; the generated enum predates it (see clients.ts `untyped`).
// StoredPurpose is that stale generated union, which the query builder still insists on -- the value
// exists in the database, so the cast is the type catching up, not a claim about the data.
type StoredPurpose = Database["public"]["Enums"]["otp_purpose"];
export type OtpPurpose = StoredPurpose | "admin_login";
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
    throw new ApiError("ACCOUNT_INACTIVE", "This account is deactivated");
  }
  if (p.status === "pending_approval") {
    throw new ApiError("ACCOUNT_PENDING", "Your instructor account is waiting for administrator approval.");
  }
}

/* ---------- OTP counters ---------- */

const isoAgo = (ms: number): string => new Date(Date.now() - ms).toISOString();

/**
 * Throws RATE_LIMITED when the 30 s resend gap or the hourly cap is hit. Does not send anything.
 *
 * Both limits are counted on the canonical mailbox (migration 038), not the literal address: Gmail
 * ignores dots and +tags, so keying on the string let the same inbox be mailed as often as the sender
 * cared to re-spell it.
 */
export async function assertCanSendOtp(db: Db, email: string, purpose: OtpPurpose): Promise<void> {
  const { data, error } = await untyped(db).rpc("otp_send_wait", { p_email: email, p_purpose: purpose });
  if (error) throw error;
  const wait = (data as number | null) ?? 0;
  if (wait <= 0) return;
  throw wait >= 600
    ? new ApiError("RATE_LIMITED", "Too many codes requested. Try again later.", { retryAfterSec: wait })
    : new ApiError("RATE_LIMITED", `Please wait ${wait}s before requesting another code.`, { retryAfterSec: wait });
}

export async function recordOtpSent(db: Db, email: string, purpose: OtpPurpose, ip: string | null): Promise<OtpInfoDto> {
  const now = Date.now();
  const { error } = await untyped(db).from("otp_codes").insert({
    email,
    throttle_key: throttleKey(email), // what the limits count; `email` stays as the person typed it
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
    .eq("purpose", purpose as StoredPurpose)
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

/**
 * Spends one of the five tries on this code and reports what is left.
 *
 * The bump happens inside `private.spend_otp_attempt` (migration 032), so the read and the write are
 * one statement. Doing it here in two -- read `attempts`, then write `attempts + 1` -- let parallel
 * guesses all see the same "before" value and advance the counter once for the whole burst, which is
 * how a 5-attempt cap became unlimited. `afterWrongCode` in policy.ts keeps the same arithmetic for
 * the unit tests; the number the user is told now comes from the database.
 */
export async function registerWrongCode(db: Db, otp: ActiveOtp): Promise<never> {
  const { data, error } = await untyped(db).rpc("spend_otp_attempt", { p_otp_id: otp.id });
  // A counter we could not spend must refuse, not wave the guess through.
  const next = error || !data ? { left: 0, locked: true } : (data as { left: number; locked: boolean });
  if (next.locked) throw new ApiError("OTP_LOCKED", "Too many wrong codes. Request a new one.");
  throw new ApiError("OTP_INVALID", `Wrong code. ${next.left} ${next.left === 1 ? "attempt" : "attempts"} left.`);
}

export async function consumeOtp(db: Db, otp: ActiveOtp): Promise<void> {
  await db.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
}

/**
 * For a resend: the flow must already have been started by the endpoint that checks the credential,
 * within the last 15 minutes. That is what stops someone who merely knows an address from having
 * codes emailed to it -- google-start verifies the Google token first, and admin login verifies the
 * password first, so only those two can create the first row.
 */
export async function assertFlowStarted(db: Db, email: string, purpose: OtpPurpose): Promise<void> {
  const { data, error } = await db
    .from("otp_codes")
    .select("id")
    .eq("email", email)
    .eq("purpose", purpose as StoredPurpose)
    .gte("sent_at", isoAgo(15 * 60_000))
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError("OTP_EXPIRED", "This session expired. Please start again.");
}

/* ---------- login attempts (lockout) ---------- */

type LockState = { locked: boolean; retryAfterSec: number };

const rateLimited = (state: LockState): ApiError =>
  new ApiError("RATE_LIMITED", `Too many attempts. Try again in ${state.retryAfterSec}s.`, {
    retryAfterSec: state.retryAfterSec,
  });

/** Refuses a locked identifier before the password is checked. Writes nothing. */
export async function checkLock(db: Db, identifier: string): Promise<void> {
  const { data, error } = await untyped(db).rpc("login_lock_state", { p_identifier: identifier });
  if (error) throw error;
  const state = data as LockState | null;
  if (state?.locked) throw rateLimited(state);
}

/**
 * Records one attempt and arms the lock in the same transaction (`private.record_login_attempt`,
 * migration 032), then refuses the caller if this failure was the fifth.
 *
 * Counting the history here and inserting the row separately meant five simultaneous attempts each
 * read an empty history and each wrote `locked = false`, so the lockout never engaged. The database
 * now takes an advisory lock on the identifier, counts, and inserts as one unit.
 */
export async function recordAttempt(
  db: Db,
  a: { identifier: string; success: boolean; role: PublicRole | null; userId: string | null; ip: string | null; userAgent: string | null },
): Promise<LockState> {
  const { data, error } = await untyped(db).rpc("record_login_attempt", {
    p_identifier: a.identifier,
    p_success: a.success,
    p_role: a.role,
    p_user_id: a.userId,
    p_ip: a.ip,
    p_user_agent: a.userAgent?.slice(0, 255) ?? null,
    // The lock counts the mailbox, not the spelling; the row keeps the spelling for the audit view.
    p_key: a.identifier.includes("@") ? throttleKey(a.identifier) : a.identifier,
  });
  if (error) throw error;
  return (data as LockState | null) ?? { locked: false, retryAfterSec: 0 };
}

// The policy is unchanged on purpose: the fifth failure is still answered with the normal
// "incorrect email or password", and it is the SIXTH attempt that checkLock refuses. Only the arming
// of the lock is fixed, not how many guesses it allows.
