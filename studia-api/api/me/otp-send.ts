// Emails a 6-digit code (through the project's SMTP) to the signed-in user's own address, before a
// profile edit or password change. The address always comes from the token, never from the body.
import { z } from "zod";
import { adminClient, anonClient } from "../../src/lib/clients.js";
import { assertCanSendOtp, recordOtpSent } from "../../src/lib/auth-core.js";
import { clientIp, endpoint } from "../../src/lib/http.js";
import { requireMe } from "../../src/lib/me.js";

const Body = z.object({ purpose: z.enum(["profile_update", "password_change"]) });

export default endpoint(Body, async ({ purpose }, req) => {
  const db = adminClient();
  const { email } = await requireMe(db, req);
  await assertCanSendOtp(db, email, purpose);
  const { error } = await anonClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) throw error;
  return recordOtpSent(db, email, purpose, clientIp(req));
});
