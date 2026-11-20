// auth-api.ts: typed, validated calls to the studia-api auth functions (Vercel).
// Every response is parsed with Zod; every failure becomes an AuthError. No retries: these are writes.
import { z } from "zod";

import { REMOTE_ENV } from "@/core/config/data-source";
import type { FieldErrors, FieldKey } from "@/features/auth/logic/auth-validation";
import { AuthError, type AuthErrorCode } from "@/features/auth/types/auth-types";

const TIMEOUT_MS = 20_000;

const CODES: readonly AuthErrorCode[] = [
  "VALIDATION", "INVALID_CREDENTIALS", "EMAIL_TAKEN", "ROLE_MISMATCH", "EMAIL_NOT_VERIFIED", "ACCOUNT_PENDING",
  "ACCOUNT_INACTIVE", "OTP_INVALID", "OTP_EXPIRED", "OTP_LOCKED", "RATE_LIMITED", "NETWORK", "UNKNOWN",
];
const FIELDS: readonly FieldKey[] = [
  "fullName", "course", "year", "section", "department", "email", "phone", "password", "confirm",
];

/* ---------- response schemas ---------- */

const Role = z.enum(["student", "instructor"]);
const SessionSchema = z.object({ accessToken: z.string(), refreshToken: z.string(), expiresAt: z.number() });
const ProfileSchema = z.object({
  id: z.string(),
  role: Role,
  fullName: z.string(),
  email: z.string(),
  course: z.string().nullable(),
  year: z.string().nullable(),
  section: z.string().nullable(),
  department: z.string().nullable(),
  phone: z.string().nullable(),
  authProvider: z.enum(["password", "google"]),
  emailVerified: z.boolean(),
  status: z.enum(["active", "inactive", "pending_approval"]),
  createdAt: z.string(),
});
const OtpInfoDto = z.object({ email: z.string(), resendInSec: z.number(), expiresInSec: z.number() });

export type SessionDto = z.infer<typeof SessionSchema>;
export type ProfileDto = z.infer<typeof ProfileSchema>;

export const schemas = {
  login: z.object({ session: SessionSchema, profile: ProfileSchema }),
  otpInfo: OtpInfoDto,
  google: OtpInfoDto.extend({
    purpose: z.enum(["google_login", "google_signup"]),
    fullName: z.string(),
  }),
  verify: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("session"), session: SessionSchema, profile: ProfileSchema }),
    z.object({ kind: z.literal("needs_profile"), session: SessionSchema, fullName: z.string() }),
    z.object({ kind: z.literal("reset_token"), session: SessionSchema }),
  ]),
  profile: z.object({ profile: ProfileSchema }),
};

const ErrorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});

/* ---------- transport ---------- */

export async function post<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  accessToken?: string,
): Promise<T> {
  if (!REMOTE_ENV.apiUrl) throw new AuthError("UNKNOWN", "The server address is not configured.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${REMOTE_ENV.apiUrl}/api/auth/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch {
    throw new AuthError("NETWORK", "Can't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new AuthError("UNKNOWN", "Something went wrong. Please try again.");
  }

  if (!res.ok) {
    const parsed = ErrorBody.safeParse(json);
    if (!parsed.success) throw new AuthError("UNKNOWN", "Something went wrong. Please try again.");
    const { code, message, fields } = parsed.data.error;
    const known = (CODES as readonly string[]).includes(code) ? (code as AuthErrorCode) : "UNKNOWN";
    let fieldErrors: FieldErrors | undefined;
    if (fields) {
      fieldErrors = {};
      for (const [k, v] of Object.entries(fields)) {
        if ((FIELDS as readonly string[]).includes(k)) fieldErrors[k as FieldKey] = v;
      }
    }
    // UNAUTHORIZED has no screen-level meaning in the mock contract: treat it as an expired session.
    throw new AuthError(code === "UNAUTHORIZED" ? "OTP_EXPIRED" : known, message, fieldErrors);
  }

  const ok = schema.safeParse(json);
  if (!ok.success) throw new AuthError("UNKNOWN", "Something went wrong. Please try again.");
  return ok.data;
}
