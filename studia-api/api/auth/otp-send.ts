// Resend a code. Google purposes can only be resent for a flow that google-start began.
import { z } from "zod";
import { adminClient, anonClient } from "../../src/lib/clients.js";
import { ApiError, clientIp, endpoint } from "../../src/lib/http.js";
import { assertCanSendOtp, assertGoogleFlowStarted, getProfileByEmail, recordOtpSent } from "../../src/lib/auth-core.js";
import { OTP, isCampusEmail, normalizeEmail } from "../../src/lib/policy.js";

const Body = z.object({
  email: z.string().max(254).transform(normalizeEmail),
  purpose: z.enum(["signup", "reset", "google_login", "google_signup"]),
});

export default endpoint(Body, async ({ email, purpose }, req) => {
  const db = adminClient();
  const generic = { email, resendInSec: OTP.resendSec, expiresInSec: OTP.ttlSec };

  if (purpose === "reset") {
    // Same answer whether or not the account exists, and throttling is swallowed (no enumeration).
    try {
      await assertCanSendOtp(db, email, "reset");
      const profile = isCampusEmail(email) ? await getProfileByEmail(db, email) : null;
      // Unknown emails get a decoy counter row and no email, so a later verify fails with the same
      // OTP_INVALID / OTP_LOCKED sequence as a real account would.
      if (profile) {
        const { error } = await anonClient().auth.resetPasswordForEmail(email);
        if (error) return generic;
      }
      return await recordOtpSent(db, email, "reset", clientIp(req));
    } catch (e) {
      if (e instanceof ApiError && e.code === "RATE_LIMITED") return generic;
      throw e;
    }
  }

  await assertCanSendOtp(db, email, purpose);

  if (purpose === "signup") {
    const profile = await getProfileByEmail(db, email);
    const { data } = await db.auth.admin.getUserById(profile?.id ?? "00000000-0000-0000-0000-000000000000");
    if (!profile || data.user?.email_confirmed_at) {
      throw new ApiError("OTP_EXPIRED", "This session expired. Please start again.");
    }
    const { error } = await anonClient().auth.resend({ type: "signup", email });
    if (error) throw error;
  } else {
    await assertGoogleFlowStarted(db, email, purpose);
    const { error } = await anonClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) throw error;
  }
  return recordOtpSent(db, email, purpose, clientIp(req));
});
