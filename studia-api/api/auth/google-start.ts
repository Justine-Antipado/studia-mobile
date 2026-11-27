// Google sign-in, step 1. The mobile app sends the native Google ID token HERE, not to Supabase.
// We exchange it server-side, throw the resulting session away, and email a 6-digit code. The client
// only receives a session after that code is verified, so the OTP really is a second factor.
import { z } from "zod";
import { adminClient, anonClient } from "../../src/lib/clients.js";
import { ApiError, clientIp, endpoint } from "../../src/lib/http.js";
import { assertAccountUsable, assertCanSendOtp, getProfile, recordOtpSent, revokeSession } from "../../src/lib/auth-core.js";
import { isCampusEmail } from "../../src/lib/policy.js";

const Body = z.object({
  idToken: z.string().min(20).max(4096),
  role: z.enum(["student", "instructor"]),
});

export default endpoint(Body, async ({ idToken, role }, req) => {
  const db = adminClient();
  const { data, error } = await anonClient().auth.signInWithIdToken({ provider: "google", token: idToken });
  if (error || !data.session || !data.user?.email) {
    if (error?.status === 400 && /gmail\.com/i.test(error.message)) {
      throw new ApiError("VALIDATION", "Use a Gmail (@gmail.com) Google account.");
    }
    // Deactivated accounts are banned at the Auth layer too (migration 026), so a blocked user
    // never reaches the profile-status check below -- say so instead of a generic sign-in failure.
    if (error?.code === "user_banned") throw new ApiError("ACCOUNT_INACTIVE", "This account is deactivated");
    if (error && (error.status ?? 0) >= 500) throw error;
    throw new ApiError("INVALID_CREDENTIALS", "Google sign-in failed. Please try again.");
  }
  await revokeSession(db, data.session.access_token); // the client never sees this session

  const email = data.user.email.trim().toLowerCase();
  if (!isCampusEmail(email)) throw new ApiError("VALIDATION", "Use a Gmail (@gmail.com) Google account.");

  const profile = await getProfile(db, data.user.id);
  if (!profile) throw new ApiError("UNKNOWN", "Something went wrong. Please try again.");

  const purpose = profile.profile_completed ? "google_login" : "google_signup";
  if (purpose === "google_login") assertAccountUsable(profile, role); // role/status before any email is sent

  await assertCanSendOtp(db, email, purpose);
  const { error: sendErr } = await anonClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (sendErr) throw sendErr;
  const info = await recordOtpSent(db, email, purpose, clientIp(req));
  return { ...info, purpose, fullName: profile.full_name };
});
