// Sets a new password once the emailed code is verified. Same strength rule as sign-up (policy.ts).
import { z } from "zod";
import { adminClient } from "../../src/lib/clients.js";
import { ApiError, endpoint } from "../../src/lib/http.js";
import { requireMe, spendCode } from "../../src/lib/me.js";
import { isStrongPassword } from "../../src/lib/policy.js";

const Body = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
  newPassword: z.string().max(64),
});

const bad = (password: string) => new ApiError("VALIDATION", "Please fix the highlighted fields.", { fields: { password } });

export default endpoint(Body, async ({ code, newPassword }, req) => {
  const db = adminClient();
  const { user, email } = await requireMe(db, req);
  if (!isStrongPassword(newPassword)) throw bad("Password does not meet all requirements.");
  await spendCode(db, email, "password_change", code);
  const { error } = await db.auth.admin.updateUserById(user.id, { password: newPassword });
  if (error) {
    if (error.code === "same_password") throw bad("Choose a password you have not used before.");
    if (error.code === "weak_password") throw bad("Password does not meet all requirements.");
    throw error;
  }
  return { ok: true };
});
