// device-flags.ts — the few things this PHONE remembers between launches, as opposed to the
// session (secure storage) or cached server data (QueryCache).
//
// They belong to the device, not to an account: signing out keeps them, and they disappear only
// when the user clears the app's data in Android app info (Settings > Apps > Studia > Storage).
// That is why sign-out.ts does not touch them — see core/logic/sign-out.ts.
import { PersistedValue, parseBoolean } from "@/core/data/storage/persisted-value";

/** The Terms and Privacy sheet was read and accepted on this device. */
export const legalAgreed = new PersistedValue<boolean>(
  "onboarding.legalAgreed.v1",
  false,
  parseBoolean,
);

/** The welcome/landing screen has been through at least once, so it is not shown again. */
export const onboardingDone = new PersistedValue<boolean>(
  "onboarding.done.v1",
  false,
  parseBoolean,
);

/**
 * Who signed in last on this phone, so the login form can be prefilled and the Google button can
 * name the account. Email only — never a password, never a token.
 */
export type LoginHint = { email: string; provider: "password" | "google"; role: "student" | "instructor" };

const parseLoginHint = (raw: unknown): LoginHint | null | undefined => {
  if (raw === null) return null;
  if (typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const { email, provider, role } = r;
  if (typeof email !== "string" || !email.includes("@")) return undefined;
  if (provider !== "password" && provider !== "google") return undefined;
  if (role !== "student" && role !== "instructor") return undefined;
  return { email, provider, role };
};

export const lastLogin = new PersistedValue<LoginHint | null>(
  "auth.lastLogin.v1",
  null,
  parseLoginHint,
);

/**
 * Resolves once every flag has been read from the device. The root layout awaits this with the
 * session, so the landing screen never flashes before we know it should be skipped.
 */
export const deviceFlagsReady: Promise<void> = Promise.all([
  legalAgreed.load(),
  onboardingDone.load(),
  lastLogin.load(),
]).then(() => undefined);
