// auth-service.ts: COMPOSITION ROOT for auth. Screens import the same names from here; the
// implementation is Supabase Auth + studia-api (remote-auth-service.ts).
import { remoteAuthService, restoreRemoteSession } from "@/features/auth/data/remote-auth-service";
import type { AuthService } from "@/features/auth/types/auth-types";

export {
  AuthError,
  BLOCKED_MESSAGE,
  isAuthError,
  type AuthErrorCode,
  type AuthService,
  type OtpInfo,
  type OtpPurpose,
  type RegisterInput,
  type Role,
  type Session,
  type User,
  type VerifyResult,
} from "@/features/auth/types/auth-types";

const service: AuthService = remoteAuthService;

/**
 * Resolves once the stored session (if any) has been loaded into the user store. The root layout
 * holds the splash screen until then, so a signed-in user is not bounced to /auth for a moment on
 * every launch. Never rejects, and gives up after 4 s so a bad connection cannot trap the splash.
 */
export const sessionReady: Promise<void> = Promise.race([
  restoreRemoteSession().catch(() => undefined), // a failed restore must not crash startup
  new Promise<void>((resolve) => setTimeout(resolve, 4000)),
]);

export const login = service.login.bind(service);
export const register = service.register.bind(service);
export const resendOtp = service.resendOtp.bind(service);
export const verifyOtp = service.verifyOtp.bind(service);
export const loginWithGoogle = service.loginWithGoogle.bind(service);
export const completeGoogleProfile = service.completeGoogleProfile.bind(service);
export const requestPasswordReset = service.requestPasswordReset.bind(service);
export const resetPassword = service.resetPassword.bind(service);
