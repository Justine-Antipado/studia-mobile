// profile-repository.ts — Account edits protected by an email OTP. Contract: docs/api-contract.md
// (purposes "profile_update" / "password_change"). The code is sent WITH the save, and the server
// verifies it (5 minutes, 5 attempts, 30 s resend) before applying anything, so there is no
// client-side "verified" flag to forge. The mock below mirrors that for offline dev only.
import { isRemote } from "@/core/config/data-source";
import { RemoteProfileRepository } from "@/features/shared-screens/data/profile-remote";
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import { setUser, type UserProfile } from "@/core/data/storage/session-store";

export type OtpPurpose = "profile_update" | "password_change";

export type ProfilePatch = Partial<Pick<UserProfile, "fullName" | "phone" | "course" | "year" | "section" | "department">>;

/** A cropped, re-encoded photo: `uri` for the preview, `base64` for the upload. */
export type AvatarFile = { uri: string; base64: string };

const OTP_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

export interface ProfileRepository {
  /** Emails a code to the signed-in user. `devCode` only exists in the mock. */
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

let pending: { purpose: OtpPurpose; code: string; expiresAt: number; attempts: number } | null = null;

class MockProfileRepository implements ProfileRepository {
  requestOtp(purpose: OtpPurpose) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    pending = { purpose, code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 };
    return mockCall(() => ({ devCode: __DEV__ ? code : undefined }));
  }

  private spend(purpose: OtpPurpose, code: string): Result<void> | null {
    if (!pending || pending.purpose !== purpose) return fail(appError("validation", "Request a new code first.", false));
    if (Date.now() > pending.expiresAt) {
      pending = null;
      return fail(appError("validation", "That code expired. Request a new one.", false));
    }
    pending.attempts += 1;
    if (pending.code !== code) {
      if (pending.attempts >= MAX_ATTEMPTS) pending = null;
      return fail(appError("validation", "Incorrect code.", false));
    }
    pending = null;
    return null;
  }

  async updateProfile(user: UserProfile, patch: ProfilePatch, code: string): Promise<Result<UserProfile>> {
    const bad = this.spend("profile_update", code);
    if (bad) return bad as Result<UserProfile>;
    const next = { ...user, ...patch };
    setUser(next);
    return mockCall(() => next);
  }

  async setAvatar(user: UserProfile, file: AvatarFile | null): Promise<Result<UserProfile>> {
    const { avatarUri: _old, ...rest } = user;
    void _old;
    const next: UserProfile = file === null ? rest : { ...rest, avatarUri: file.uri };
    setUser(next);
    return mockCall(() => next);
  }

  async changePassword(_newPassword: string, code: string): Promise<Result<void>> {
    const bad = this.spend("password_change", code);
    if (bad) return bad;
    return mockCall(() => undefined);
  }

  async loadAvatar() {}
}

export const profileRepository: ProfileRepository = isRemote ? new RemoteProfileRepository() : new MockProfileRepository();
