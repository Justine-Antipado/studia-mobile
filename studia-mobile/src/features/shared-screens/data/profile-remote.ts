// profile-remote.ts: Account edits against the studia-api "me" endpoints (Vercel), which sit in front
// of Supabase. The server mails the 6-digit code through the project's SMTP, verifies it (5 minutes,
// 5 attempts), and only then writes to the database with the service role:
//   POST /api/me/otp-send         { purpose }
//   POST /api/me/profile-update   { code, fullName, phone, course|year|section | department }
//   POST /api/me/password-change  { code, newPassword }
//   POST /api/me/avatar           { action: get | set | remove, data? }  (private `avatars` bucket)
import { z } from "zod";

import { appError, fail, ok, type AppError, type Result } from "@/core/data/errors/app-error";
import { getSupabase } from "@/core/data/supabase/client";
import { getUser, setUser, type UserProfile } from "@/core/data/storage/session-store";
import { post } from "@/features/auth/data/auth-api";
import { AuthError } from "@/features/auth/types/auth-types";
import type {
  AvatarFile,
  OtpPurpose,
  ProfilePatch,
  ProfileRepository,
} from "@/features/shared-screens/data/profile-repository";

const DEPARTMENTS = ["FM", "OM", "IT", "ED"] as const;
const departmentCode = (label: string | undefined) =>
  DEPARTMENTS.find((d) => new RegExp(`\\b${d}\\b`).test((label ?? "").toUpperCase())) ?? null;

const Sent = z.object({ email: z.string(), resendInSec: z.number(), expiresInSec: z.number() });
const Done = z.object({}).passthrough();
const Avatar = z.object({ url: z.string().nullable() });

async function token(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new AuthError("OTP_EXPIRED", "Your session has ended. Please sign in again.");
  return t;
}

function toError(e: unknown): AppError {
  if (e instanceof AuthError) {
    if (e.code === "NETWORK") return appError("network", e.message);
    if (e.code === "RATE_LIMITED") return appError("validation", e.message, false);
    if (e.fields) {
      const first = Object.values(e.fields)[0];
      if (first) return appError("validation", first, false);
    }
    if (e.code === "OTP_EXPIRED" || e.code === "ACCOUNT_INACTIVE" || e.code === "ACCOUNT_PENDING") {
      return appError("unauthorized", e.message, false);
    }
    return appError("validation", e.message, false);
  }
  return appError("unknown", "Something went wrong. Please try again.", false);
}

async function call<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<Result<T>> {
  try {
    return ok(await post(path, body, schema, await token()));
  } catch (e) {
    return fail(toError(e));
  }
}

export class RemoteProfileRepository implements ProfileRepository {
  async requestOtp(purpose: OtpPurpose): Promise<Result<{ devCode?: string }>> {
    const r = await call("me/otp-send", { purpose }, Sent);
    return r.ok ? ok({}) : r;
  }

  async updateProfile(user: UserProfile, patch: ProfilePatch, code: string): Promise<Result<UserProfile>> {
    const body: Record<string, string> = { code, fullName: patch.fullName ?? user.fullName, phone: patch.phone ?? "" };
    if (user.role === "student") {
      body.course = patch.course ?? user.course ?? "";
      body.year = (patch.year ?? user.year ?? "").match(/\d/)?.[0] ?? "";
      body.section = (patch.section ?? user.section ?? "").replace(/^.*-/, "").trim().toUpperCase();
    } else {
      const dept = departmentCode(patch.department ?? user.department);
      if (!dept) return fail(appError("validation", "Choose a valid department.", false));
      body.department = dept;
    }
    const r = await call("me/profile-update", body, Done);
    if (!r.ok) return r;
    const next = { ...user, ...patch };
    setUser(next);
    return ok(next);
  }

  async changePassword(newPassword: string, code: string): Promise<Result<void>> {
    const r = await call("me/password-change", { code, newPassword }, Done);
    return r.ok ? ok(undefined) : r;
  }

  // The photo lives in the private `avatars` bucket (migration 015). The server sniffs the real file
  // type, stores it under the caller's own folder and hands back a short-lived signed URL.
  async setAvatar(user: UserProfile, file: AvatarFile | null): Promise<Result<UserProfile>> {
    const r = await call(
      "me/avatar",
      file ? { action: "set", data: file.base64 } : { action: "remove" },
      Avatar,
    );
    if (!r.ok) return r;
    const { avatarUri: _old, ...rest } = user;
    void _old;
    const next: UserProfile = r.value.url ? { ...rest, avatarUri: r.value.url } : rest;
    setUser(next);
    return ok(next);
  }

  async loadAvatar(): Promise<void> {
    const me = getUser();
    if (!me) return;
    const r = await call("me/avatar", { action: "get" }, Avatar);
    const current = getUser();
    if (r.ok && r.value.url && current && current.email === me.email) setUser({ ...current, avatarUri: r.value.url });
    // no saved photo or no connection: the initials are shown
  }
}
