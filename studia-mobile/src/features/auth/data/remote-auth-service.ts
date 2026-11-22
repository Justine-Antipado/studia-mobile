// remote-auth-service.ts: AuthService backed by Supabase Auth + the studia-api functions.
//
// Where each rule is enforced (the client never decides):
//   - email/domain, password strength, role/status gates, OTP expiry + 5 attempts + 30 s resend,
//     5-fails/1-min lockout, Google ID-token verification  -> studia-api (service role) + Auth hook/RLS
//   - session storage -> expo-secure-store (core/data/supabase). Tokens never touch AsyncStorage.
import { REMOTE_ENV } from "@/core/config/data-source";
import { createEphemeralClient, getSupabase, supabaseConfigured } from "@/core/data/supabase/client";
import { isEndingSession } from "@/core/data/supabase/end-session";
import { setUser } from "@/core/data/storage/session-store";
import { toProfile } from "@/features/auth/logic/user-profile";
import { post, schemas, type ProfileDto, type SessionDto } from "@/features/auth/data/auth-api";
import {
  composeSection,
  isStrongPassword,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  validateAll,
  type FieldKey,
} from "@/features/auth/logic/auth-validation";
import {
  AuthError,
  type AuthService,
  type OtpInfo,
  type OtpPurpose,
  type RegisterInput,
  type Role,
  type Session,
  type User,
} from "@/features/auth/types/auth-types";

const PENDING_TTL_MS = 10 * 60_000;
const GENERIC = "Something went wrong. Please try again.";

/* ---------- mapping (snake/DTO -> app types, data layer only) ---------- */

function toUser(p: ProfileDto): User {
  const student = p.role === "student";
  return {
    id: p.id,
    role: p.role,
    fullName: p.fullName,
    email: p.email,
    section: student && p.course && p.year && p.section ? composeSection(p.course, p.year, p.section) : undefined,
    department: student ? undefined : (p.department ?? undefined),
    phone: p.phone ?? undefined,
    authProvider: p.authProvider,
    emailVerified: p.emailVerified,
    status: p.status === "pending_approval" ? "pending_approval" : "active",
    createdAt: p.createdAt,
  };
}

const toSession = (profile: ProfileDto, s: SessionDto): Session => ({
  user: toUser(profile),
  accessToken: s.accessToken,
  expiresAt: s.expiresAt,
});

/** Persists the session in secure storage (supabase-js owns refresh from here on). */
async function persist(s: SessionDto): Promise<void> {
  const { error } = await getSupabase().auth.setSession({ access_token: s.accessToken, refresh_token: s.refreshToken });
  if (error) throw new AuthError("UNKNOWN", GENERIC);
}

/* ---------- short-lived sessions held in memory (profile completion, password reset) ---------- */

const pending = new Map<string, { session: SessionDto; expiresAt: number }>();

function hold(session: SessionDto): string {
  const now = Date.now();
  for (const [k, v] of pending) if (v.expiresAt < now) pending.delete(k);
  pending.set(session.accessToken, { session, expiresAt: now + PENDING_TTL_MS });
  return session.accessToken;
}

function take(token: string): SessionDto {
  const entry = pending.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    pending.delete(token);
    throw new AuthError("OTP_EXPIRED", "This session expired. Please start again.");
  }
  return entry.session;
}

/* ---------- input validation (the server re-checks everything) ---------- */

function assertValid(keys: readonly FieldKey[], values: Partial<Record<FieldKey, string>>, role: Role, strict: boolean) {
  const fields = validateAll(keys, values, { role, strict });
  if (Object.keys(fields).length) throw new AuthError("VALIDATION", "Please fix the highlighted fields.", fields);
}

const roleKeys = (role: Role): FieldKey[] => (role === "student" ? ["course", "year", "section"] : ["department"]);

/* ---------- Google (native; needs a dev/EAS build, not Expo Go) ---------- */

let googleConfigured = false;

async function getGoogleIdToken(): Promise<string> {
  let mod: typeof import("@react-native-google-signin/google-signin");
  try {
    mod = await import("@react-native-google-signin/google-signin");
  } catch {
    throw new AuthError("UNKNOWN", "Google sign-in needs a development build (it does not run in Expo Go).");
  }
  const { GoogleSignin, isSuccessResponse } = mod;
  if (!googleConfigured) {
    GoogleSignin.configure({
      webClientId: REMOTE_ENV.googleWebClientId,
      iosClientId: REMOTE_ENV.googleIosClientId || undefined,
    });
    googleConfigured = true;
  }
  try {
    await GoogleSignin.hasPlayServices();
    await GoogleSignin.signOut().catch(() => undefined); // always show the account chooser
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res) || !res.data.idToken) throw new AuthError("UNKNOWN", "Google sign-in was cancelled.");
    return res.data.idToken;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError("UNKNOWN", "Google sign-in failed. Please try again.");
  }
}

/* ---------- the service ---------- */

export const remoteAuthService: AuthService = {
  async login(input) {
    assertValid(["email", "password"], input, input.role, false);
    const r = await post("login", { identifier: normalizeEmail(input.email), password: input.password, role: input.role }, schemas.login);
    await persist(r.session);
    return toSession(r.profile, r.session);
  },

  async register(input: RegisterInput) {
    assertValid(["fullName", ...roleKeys(input.role), "email", "phone", "password"], input, input.role, true);
    const r = await post(
      "register",
      {
        role: input.role,
        fullName: normalizeName(input.fullName),
        email: normalizeEmail(input.email),
        password: input.password,
        course: input.course || undefined,
        year: input.year || undefined,
        section: input.section || undefined,
        department: input.department || undefined,
        phone: normalizePhone(input.phone ?? "") ?? "",
      },
      schemas.otpInfo,
    );
    return { email: r.email, resendInSec: r.resendInSec, expiresInSec: r.expiresInSec };
  },

  async resendOtp(emailRaw: string, purpose: OtpPurpose): Promise<OtpInfo> {
    const r = await post("otp-send", { email: normalizeEmail(emailRaw), purpose }, schemas.otpInfo);
    return { resendInSec: r.resendInSec, expiresInSec: r.expiresInSec };
  },

  async verifyOtp({ email, purpose, code }) {
    const r = await post("otp-verify", { email: normalizeEmail(email), purpose, code }, schemas.verify);
    switch (r.kind) {
      case "session":
        await persist(r.session);
        return { kind: "session", session: toSession(r.profile, r.session) };
      case "needs_profile":
        return { kind: "needs_profile", profileToken: hold(r.session), fullName: r.fullName };
      case "reset_token":
        return { kind: "reset_token", resetToken: hold(r.session) };
    }
  },

  async loginWithGoogle(role) {
    const idToken = await getGoogleIdToken();
    const r = await post("google-start", { idToken, role }, schemas.google);
    return { email: r.email, purpose: r.purpose, resendInSec: r.resendInSec, expiresInSec: r.expiresInSec };
  },

  async completeGoogleProfile(input) {
    assertValid(["fullName", ...roleKeys(input.role), "phone"], input, input.role, true);
    const session = take(input.profileToken);
    const r = await post(
      "complete-profile",
      {
        role: input.role,
        fullName: normalizeName(input.fullName),
        course: input.course || undefined,
        year: input.year || undefined,
        section: input.section || undefined,
        department: input.department || undefined,
        phone: normalizePhone(input.phone ?? "") ?? "",
      },
      schemas.profile,
      session.accessToken,
    );
    pending.delete(input.profileToken); // single use
    if (r.profile.status === "pending_approval") {
      throw new AuthError("ACCOUNT_PENDING", "Your instructor account is waiting for administrator approval.");
    }
    await persist(session);
    return toSession(r.profile, session);
  },

  async requestPasswordReset(emailRaw: string): Promise<OtpInfo> {
    const r = await post("otp-send", { email: normalizeEmail(emailRaw), purpose: "reset" }, schemas.otpInfo);
    return { resendInSec: r.resendInSec, expiresInSec: r.expiresInSec };
  },

  async resetPassword({ resetToken, newPassword }) {
    if (!isStrongPassword(newPassword)) {
      throw new AuthError("VALIDATION", "Please fix the highlighted fields.", {
        password: "Password does not meet all requirements.",
      });
    }
    const s = take(resetToken);
    const db = createEphemeralClient(); // never persisted
    const set = await db.auth.setSession({ access_token: s.accessToken, refresh_token: s.refreshToken });
    if (set.error) throw new AuthError("OTP_EXPIRED", "This reset session expired. Start again.");
    const { error } = await db.auth.updateUser({ password: newPassword });
    if (error) {
      if (error.code === "weak_password" || error.code === "same_password") {
        throw new AuthError("VALIDATION", "Please fix the highlighted fields.", {
          password: error.code === "same_password" ? "Choose a password you have not used before." : "Password does not meet all requirements.",
        });
      }
      throw new AuthError(error.status && error.status < 500 ? "OTP_EXPIRED" : "NETWORK", error.status && error.status < 500 ? "This reset session expired. Start again." : "Can't reach the server. Check your connection and try again.");
    }
    pending.delete(resetToken); // single use
    await db.auth.signOut({ scope: "global" }).catch(() => undefined); // revoke EVERY session of this account
  },
};

/* ---------- session restore + server-side sign-out ---------- */

let started = false;

/** Reloads the stored session into the in-memory user store. Safe to call more than once. */
export async function restoreRemoteSession(): Promise<void> {
  if (!supabaseConfigured || started) return;
  started = true;
  const db = getSupabase();

  db.auth.onAuthStateChange((event) => {
    if (event !== "SIGNED_OUT" || isEndingSession()) return;
    // The server revoked us or the refresh token died: drop the user and every cache.
    void import("@/core/logic/sign-out").then((m) => m.signOut());
  });

  const { data } = await db.auth.getSession();
  if (!data.session) return;
  const { data: row } = await db
    .from("users")
    .select("id, role, full_name, email, course, year_level, section, department, phone, status, auth_provider, created_at")
    .eq("id", data.session.user.id)
    .maybeSingle();
  if (!row || row.status !== "active" || row.role === "admin") {
    await db.auth.signOut({ scope: "local" }).catch(() => undefined);
    return;
  }
  setUser(
    toProfile(
      toUser({
        id: row.id,
        role: row.role,
        fullName: row.full_name,
        email: row.email,
        course: row.course,
        year: row.year_level,
        section: row.section,
        department: row.department,
        phone: row.phone,
        authProvider: row.auth_provider,
        emailVerified: true,
        status: row.status,
        createdAt: row.created_at,
      }),
    ),
  );
  void import("@/features/shared-screens/data/profile-repository").then((m) => m.profileRepository.loadAvatar());
}
