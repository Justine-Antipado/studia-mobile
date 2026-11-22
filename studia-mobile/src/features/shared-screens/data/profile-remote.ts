// profile-remote.ts: Account edits against Supabase. The email code is Supabase Auth's own OTP to
// the signed-in address (signInWithOtp + verifyOtp), so editing a profile or changing the password
// still needs proof of mailbox access. The row update is limited by column grants + RLS, and the
// password change uses auth.updateUser on the verified session.
// NOT done here: profile photo storage (needs a studia-api endpoint, see migration 015) — a chosen
// photo is kept on this device only.
import { appError, fail, ok, type Result } from "@/core/data/errors/app-error";
import { db, guard, must } from "@/core/data/supabase/remote";
import { getSupabase } from "@/core/data/supabase/client";
import { setUser, type UserProfile } from "@/core/data/storage/session-store";
import type { OtpPurpose, ProfilePatch, ProfileRepository } from "@/features/shared-screens/data/profile-repository";

let verified: OtpPurpose | null = null;
let verifiedFor: OtpPurpose | null = null;

const DEPARTMENTS = ["FM", "OM", "IT", "ED"] as const;
const departmentCode = (label: string | undefined) => DEPARTMENTS.find((d) => new RegExp(`\\b${d}\\b`).test((label ?? "").toUpperCase())) ?? null;

async function email(): Promise<string> {
  const { data } = await getSupabase().auth.getUser();
  const e = data.user?.email;
  if (!e) throw appError("unauthorized", "Your session has ended. Please sign in again.", false);
  return e;
}

export class RemoteProfileRepository implements ProfileRepository {
  requestOtp(purpose: OtpPurpose): Promise<Result<{ devCode?: string }>> {
    verified = null;
    return guard(async () => {
      const { error } = await getSupabase().auth.signInWithOtp({ email: await email(), options: { shouldCreateUser: false } });
      if (error) throw error;
      verifiedFor = purpose;
      return {};
    });
  }

  async verifyOtp(purpose: OtpPurpose, code: string): Promise<Result<void>> {
    if (verifiedFor !== purpose) return fail(appError("validation", "Request a new code first."));
    const res = await guard(async () => {
      const { error } = await getSupabase().auth.verifyOtp({ email: await email(), token: code.trim(), type: "email" });
      if (error) throw appError("validation", "Incorrect or expired code.", false);
    });
    if (res.ok) verified = purpose;
    return res;
  }

  async updateProfile(user: UserProfile, patch: ProfilePatch): Promise<Result<UserProfile>> {
    if (verified !== "profile_update") return fail(appError("unauthorized", "Verify the code first.", false));
    const update: Record<string, string | null> = {};
    if (patch.fullName !== undefined) update.full_name = patch.fullName.trim();
    if (patch.phone !== undefined) update.phone = patch.phone || null;
    if (patch.course !== undefined) update.course = patch.course;
    if (patch.year !== undefined) update.year_level = patch.year.match(/\d/)?.[0] ?? null;
    if (patch.section !== undefined) update.section = patch.section.replace(/^.*-/, "").trim().toUpperCase() || null;
    if (patch.department !== undefined) {
      const code = departmentCode(patch.department);
      if (!code) return fail(appError("validation", "Choose a valid department.", false));
      update.department = code;
    }
    const res = await guard(async () => {
      const { data } = await getSupabase().auth.getUser();
      must(await db().from("users").update(update).eq("id", data.user?.id ?? ""));
    });
    if (!res.ok) return res;
    verified = null;
    const next = { ...user, ...patch };
    setUser(next);
    return ok(next);
  }

  async setAvatar(user: UserProfile, uri: string | null): Promise<Result<UserProfile>> {
    if (uri !== null && !/^(file|content):\/\//.test(uri)) {
      return fail(appError("validation", "That photo could not be used.", false));
    }
    const { avatarUri: _old, ...rest } = user;
    void _old;
    const next: UserProfile = uri === null ? rest : { ...rest, avatarUri: uri };
    setUser(next);
    return ok(next);
  }

  async changePassword(newPassword: string): Promise<Result<void>> {
    if (verified !== "password_change") return fail(appError("unauthorized", "Verify the code first.", false));
    const res = await guard(async () => {
      const { error } = await getSupabase().auth.updateUser({ password: newPassword });
      if (error) throw appError("validation", "That password could not be used. Try a stronger one.", false);
    });
    if (res.ok) verified = null;
    return res;
  }
}
