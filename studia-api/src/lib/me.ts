// Shared by the signed-in "me" endpoints (Account > Personal Information / Password / Photo).
// Every call is tied to the caller's own access token: the user id comes from the verified token,
// never from the request body.
import type { User } from "@supabase/supabase-js";
import type { VercelRequest } from "@vercel/node";
import type { Db } from "./clients.js";
import { anonClient } from "./clients.js";
import {
  assertAccountUsable,
  consumeOtp,
  getActiveOtp,
  getProfile,
  registerWrongCode,
  type OtpPurpose,
  type Profile,
} from "./auth-core.js";
import { ApiError, bearer } from "./http.js";
import { normalizeEmail } from "./policy.js";

export type MePurpose = Extract<OtpPurpose, "profile_update" | "password_change">;

export async function requireMe(db: Db, req: VercelRequest): Promise<{ user: User; profile: Profile; email: string }> {
  const { data, error } = await db.auth.getUser(bearer(req));
  if (error || !data.user?.email) throw new ApiError("UNAUTHORIZED", "Please sign in again.");
  const profile = await getProfile(db, data.user.id);
  if (!profile) throw new ApiError("UNAUTHORIZED", "Please sign in again.");
  assertAccountUsable(profile);
  return { user: data.user, profile, email: normalizeEmail(data.user.email) };
}

/** Checks the emailed code (5 tries, 5 minutes) and burns it. Throws OTP_* errors on failure. */
export async function spendCode(db: Db, email: string, purpose: MePurpose, code: string): Promise<void> {
  const otp = await getActiveOtp(db, email, purpose);
  const { data, error } = await anonClient().auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data.session) {
    if (error && (error.status ?? 0) >= 500) throw error;
    return registerWrongCode(db, otp); // always throws
  }
  await consumeOtp(db, otp);
  // verifyOtp minted a throw-away session for the same user; revoke it so only the app's session lives.
  await db.auth.admin.signOut(data.session.access_token, "local").catch(() => undefined);
}
