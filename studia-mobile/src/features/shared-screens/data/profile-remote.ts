// profile-remote.ts: Account edits against the studia-api "me" endpoints (Vercel), which sit in front
// of Supabase. The server mails the 6-digit code through the project's SMTP, verifies it (5 minutes,
// 5 attempts), and only then writes to the database with the service role:
//   POST /api/me/otp-send         { purpose }
//   POST /api/me/profile-update   { code, fullName, phone, course|year|section | department }
//   POST /api/me/password-change  { code, newPassword }
// The profile photo is kept on the device only (see setAvatar).
import AsyncStorage from "@react-native-async-storage/async-storage";
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
const avatarKey = (email: string) => `studia.avatar.${email.toLowerCase()}`;

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

  // The photo stays on this device (AsyncStorage, keyed by email): no upload, no signed URLs, nothing
  // extra for the server to store or serve. The trade-off is that it is not shared across devices.
  async setAvatar(user: UserProfile, file: AvatarFile | null): Promise<Result<UserProfile>> {
    try {
      if (file) await AsyncStorage.setItem(avatarKey(user.email), `data:image/jpeg;base64,${file.base64}`);
      else await AsyncStorage.removeItem(avatarKey(user.email));
    } catch {
      return fail(appError("unknown", "Could not save the photo on this device.", false));
    }
    const { avatarUri: _old, ...rest } = user;
    void _old;
    const next: UserProfile = file ? { ...rest, avatarUri: file.uri } : rest;
    setUser(next);
    return ok(next);
  }

  async loadAvatar(): Promise<void> {
    const me = getUser();
    if (!me) return;
    try {
      const uri = await AsyncStorage.getItem(avatarKey(me.email));
      const current = getUser();
      if (uri && current && current.email === me.email) setUser({ ...current, avatarUri: uri });
    } catch {
      // no saved photo: the initials are shown
    }
  }
}
