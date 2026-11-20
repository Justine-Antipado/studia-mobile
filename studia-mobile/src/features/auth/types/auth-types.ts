// auth-types.ts: shared contract for every AuthService implementation (mock and remote).
import type { FieldErrors, Role } from "@/features/auth/logic/auth-validation";
export type { Role };


export type OtpPurpose = "signup" | "google_login" | "google_signup" | "reset";

export type AuthErrorCode =
  | "VALIDATION"
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "ROLE_MISMATCH"
  | "EMAIL_NOT_VERIFIED"
  | "ACCOUNT_PENDING"
  | "ACCOUNT_INACTIVE"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_LOCKED"
  | "RATE_LIMITED"
  | "NETWORK"
  | "UNKNOWN";

export class AuthError extends Error {
  code: AuthErrorCode;
  fields?: FieldErrors;
  constructor(code: AuthErrorCode, message: string, fields?: FieldErrors) {
    super(message);
    Object.setPrototypeOf(this, AuthError.prototype); // keeps `instanceof` reliable after transpiling
    this.name = "AuthError";
    this.code = code;
    this.fields = fields;
  }
}

export const isAuthError = (e: unknown): e is AuthError =>
  e instanceof AuthError ||
  (typeof e === "object" &&
    e !== null &&
    (e as { name?: string }).name === "AuthError");

export type User = {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  section?: string; // e.g. "BSIT 3-A" (course + year + section)
  department?: string;
  phone?: string;
  authProvider: "password" | "google";
  emailVerified: boolean;
  status: "active" | "pending_approval";
  createdAt: string;
};

export type Session = { user: User; accessToken: string; expiresAt: number };

export type OtpInfo = {
  resendInSec: number;
  expiresInSec: number;
  devCode?: string;
};

export type VerifyResult =
  | { kind: "session"; session: Session }
  | { kind: "needs_profile"; profileToken: string; fullName: string }
  | { kind: "reset_token"; resetToken: string };

export type RegisterInput = {
  role: Role;
  fullName: string;
  email: string;
  password: string;
  course?: string;
  year?: string;
  section?: string;
  department?: string;
  phone?: string;
};

export type CompleteProfileInput = {
  profileToken: string;
  role: Role;
  fullName: string;
  course?: string;
  year?: string;
  section?: string;
  department?: string;
  phone?: string;
};

/** The one surface the auth screen talks to. The mock and the Supabase-backed service both implement it. */
export interface AuthService {
  login(input: { email: string; password: string; role: Role }): Promise<Session>;
  register(input: RegisterInput): Promise<OtpInfo & { email: string }>;
  resendOtp(email: string, purpose: OtpPurpose): Promise<OtpInfo>;
  verifyOtp(input: { email: string; purpose: OtpPurpose; code: string }): Promise<VerifyResult>;
  loginWithGoogle(role: Role): Promise<OtpInfo & { email: string; purpose: OtpPurpose }>;
  completeGoogleProfile(input: CompleteProfileInput): Promise<Session>;
  requestPasswordReset(email: string): Promise<OtpInfo>;
  resetPassword(input: { resetToken: string; newPassword: string }): Promise<void>;
}
