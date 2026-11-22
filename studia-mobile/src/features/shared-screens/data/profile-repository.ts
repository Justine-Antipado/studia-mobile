// profile-repository.ts — Account edits protected by an email OTP. Contract: docs/api-contract.md
// (purposes "profile_update" / "password_change"). The code is sent WITH the save, and the server
// verifies it (5 minutes, 5 attempts, 30 s resend) before applying anything, so there is no
// client-side "verified" flag to forge.
import type { Result } from "@/core/data/errors/app-error";
import type { UserProfile } from "@/core/data/storage/session-store";
import { RemoteProfileRepository } from "@/features/shared-screens/data/profile-remote";

export type OtpPurpose = "profile_update" | "password_change";

export type ProfilePatch = Partial<Pick<UserProfile, "fullName" | "phone" | "course" | "year" | "section" | "department">>;

/** A cropped, re-encoded photo: `uri` for the preview, `base64` for the upload. */
export type AvatarFile = { uri: string; base64: string };

export interface ProfileRepository {
  /** Emails a code to the signed-in user. */
  requestOtp(purpose: OtpPurpose): Promise<Result<{ devCode?: string }>>;
  /** Verifies `code` and applies the edit in one call. */
  updateProfile(user: UserProfile, patch: ProfilePatch, code: string): Promise<Result<UserProfile>>;
  /** Verifies `code` and sets the new password in one call. */
  changePassword(newPassword: string, code: string): Promise<Result<void>>;
  /** Sets or (file = null) removes the profile photo. No OTP: a photo is not a credential. */
  setAvatar(user: UserProfile, file: AvatarFile | null): Promise<Result<UserProfile>>;
  /** Loads the saved photo into the session user (no-op when there is none). */
  loadAvatar(): Promise<void>;
}

export const profileRepository: ProfileRepository = new RemoteProfileRepository();
