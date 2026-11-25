// device-flags.ts — the few things this PHONE remembers between launches, as opposed to the
// session (secure storage) or cached server data (QueryCache).
//
// They belong to the device, not to an account: signing out keeps them, and they disappear only
// when the user clears the app's data in Android app info (Settings > Apps > Studia > Storage).
// That is why sign-out.ts does not touch them — see core/logic/sign-out.ts.
import { deviceStore, STORAGE_PREFIX } from "@/core/data/storage/key-value-store";
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
 * PRIVACY: this device used to remember the last account that signed in here ("auth.lastLogin.v1":
 * email + provider + role), which the login form used to prefill the email field and to label the
 * Google button "Continue as <email>". That showed one user's address to the next person who
 * opened the app on a shared or lost phone, so the hint is gone and the key is deleted on launch
 * for installs that still carry it. Do not reintroduce a login hint here.
 */
const purgeLoginHint = (): Promise<void> =>
  deviceStore.remove(`${STORAGE_PREFIX}auth.lastLogin.v1`).catch(() => undefined);

/**
 * Resolves once every flag has been read from the device. The root layout awaits this with the
 * session, so the landing screen never flashes before we know it should be skipped.
 */
export const deviceFlagsReady: Promise<void> = Promise.all([
  legalAgreed.load(),
  onboardingDone.load(),
  purgeLoginHint(),
]).then(() => undefined);
