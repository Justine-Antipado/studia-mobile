// auth-service.ts: COMPOSITION ROOT for auth. The only file that knows which implementation runs.
// EXPO_PUBLIC_DATA_SOURCE=mock (default) -> in-memory mock; =remote -> Supabase Auth + studia-api.
// Screens keep importing the same names from here, so switching back to mock is one env change.
import { isRemote } from "@/core/config/data-source";
import { mockAuthService } from "@/features/auth/data/mock-auth-service";
import { remoteAuthService, restoreRemoteSession } from "@/features/auth/data/remote-auth-service";
import type { AuthService } from "@/features/auth/types/auth-types";

export {
  AuthError,
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

const service: AuthService = isRemote ? remoteAuthService : mockAuthService;

if (isRemote) void restoreRemoteSession().catch(() => undefined); // never let a failed restore crash startup

export const login = service.login.bind(service);
export const register = service.register.bind(service);
export const resendOtp = service.resendOtp.bind(service);
export const verifyOtp = service.verifyOtp.bind(service);
export const loginWithGoogle = service.loginWithGoogle.bind(service);
export const completeGoogleProfile = service.completeGoogleProfile.bind(service);
export const requestPasswordReset = service.requestPasswordReset.bind(service);
export const resetPassword = service.resetPassword.bind(service);
