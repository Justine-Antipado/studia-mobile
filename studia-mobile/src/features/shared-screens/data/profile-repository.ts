// profile-repository.ts — OTP-protected profile edits (mock). The real API must: send a single-use
// OTP bound to the user + purpose, expire it after 5 minutes, allow 5 attempts, and only apply the
// change after a successful verify (docs/api-contract.md, purposes "profile_update" / "password_change").
import { isRemote } from "@/core/config/data-source";
import { RemoteProfileRepository } from "@/features/shared-screens/data/profile-remote";
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import { setUser, type UserProfile } from "@/core/data/storage/session-store";

export type OtpPurpose = "profile_update" | "password_change";

export type ProfilePatch = Partial<Pick<UserProfile, "fullName" | "phone" | "course" | "year" | "section" | "department">>;

const OTP_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

let pending: { purpose: OtpPurpose; code: string; expiresAt: number; attempts: number } | null = null;

export interface ProfileRepository {
  /** `devCode` is only returned in __DEV__ so the flow can be tested without email. */
  requestOtp(purpose: OtpPurpose): Promise<Result<{ devCode?: string }>>;
  verifyOtp(purpose: OtpPurpose, code: string): Promise<Result<void>>;
  /** Requires a verified OTP for "profile_update". */
  updateProfile(user: UserProfile, patch: ProfilePatch): Promise<Result<UserProfile>>;
  changePassword(newPassword: string): Promise<Result<void>>;
  /** Sets or (uri = null) removes the profile photo. No OTP: a photo is not a credential. */
  setAvatar(user: UserProfile, uri: string | null): Promise<Result<UserProfile>>;
}

let verified: OtpPurpose | null = null;

class MockProfileRepository implements ProfileRepository {
  requestOtp(purpose: OtpPurpose) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    pending = { purpose, code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 };
    verified = null;
    return mockCall(() => ({ devCode: __DEV__ ? code : undefined }));
  }

  async verifyOtp(purpose: OtpPurpose, code: string): Promise<Result<void>> {
    if (!pending || pending.purpose !== purpose) {
      return fail(appError("validation", "Request a new code first."));
    }
    if (Date.now() > pending.expiresAt) {
      pending = null;
      return fail(appError("validation", "That code expired. Request a new one."));
    }
    pending.attempts += 1;
    if (pending.code !== code) {
      if (pending.attempts >= MAX_ATTEMPTS) pending = null;
      return fail(appError("validation", "Incorrect code."));
    }
    pending = null;
    verified = purpose; // single use: consumed by the next write below
    return mockCall(() => undefined);
  }

  async updateProfile(user: UserProfile, patch: ProfilePatch): Promise<Result<UserProfile>> {
    if (verified !== "profile_update") return fail(appError("unauthorized", "Verify the code first.", false));
    verified = null;
    const next = { ...user, ...patch };
    setUser(next); // header + Account card update immediately
    return mockCall(() => next);
  }

  async setAvatar(user: UserProfile, uri: string | null): Promise<Result<UserProfile>> {
    if (uri !== null && !/^(file|content):\/\//.test(uri)) {
      return fail(appError("validation", "That photo could not be used.", false));
    }
    const { avatarUri: _old, ...rest } = user;
    void _old;
    const next: UserProfile = uri === null ? rest : { ...rest, avatarUri: uri };
    setUser(next);
    return mockCall(() => next);
  }

  async changePassword(): Promise<Result<void>> {
    if (verified !== "password_change") return fail(appError("unauthorized", "Verify the code first.", false));
    verified = null;
    return mockCall(() => undefined);
  }
}

export const profileRepository: ProfileRepository = isRemote ? new RemoteProfileRepository() : new MockProfileRepository();

