// Pure auth policy (no I/O) so the rules are unit-testable and match the mobile mock exactly.

export const OTP = { ttlSec: 300, resendSec: 30, maxAttempts: 5, maxPerHour: 10 } as const;
export const LOGIN = { maxFails: 5, windowMs: 60_000, lockMs: 60_000 } as const;
/** Allowed sign-up domains: any Google account, plus the campus domain (seeded users). Keep in sync with migration 009. */
export const ALLOWED_DOMAINS = ["gmail.com", "omsu.edu.ph"] as const;

export const EMAIL_RE = /^[a-z0-9._+-]{1,64}@(gmail\.com|omsu\.edu\.ph)$/;
export const normalizeEmail = (v: string): string => v.trim().toLowerCase();
export const isCampusEmail = (v: string): boolean => EMAIL_RE.test(normalizeEmail(v));

const PW_RULES: readonly RegExp[] = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
export const isStrongPassword = (p: string): boolean =>
  p.length >= 8 && p.length <= 64 && PW_RULES.every((r) => r.test(p));

/** "+639XXXXXXXXX" | "" (not given) | null (invalid). Same rule as the mobile validator. */
export function normalizePhone(v: string): string | null {
  const c = v.replace(/[\s-]/g, "");
  if (!c) return "";
  if (/^09\d{9}$/.test(c)) return `+63${c.slice(1)}`;
  if (/^\+639\d{9}$/.test(c)) return c;
  return null;
}

/* ---------- login lockout (5 fails / 1 min) ---------- */

export type Attempt = { success: boolean; locked: boolean; at: number };

/** `recent` = attempts newer than the window, newest first. */
export function lockState(
  recent: readonly Attempt[],
  now: number,
): { locked: boolean; retryAfterSec: number } {
  const lock = recent.find((a) => a.locked && now - a.at < LOGIN.lockMs);
  if (!lock) return { locked: false, retryAfterSec: 0 };
  return { locked: true, retryAfterSec: Math.max(1, Math.ceil((lock.at + LOGIN.lockMs - now) / 1000)) };
}

/** True when the failure being recorded now is the 5th since the last success/lock. */
export function failureTriggersLock(recent: readonly Attempt[], now: number): boolean {
  let fails = 0;
  for (const a of recent) {
    if (now - a.at >= LOGIN.windowMs || a.success || a.locked) break;
    fails += 1;
  }
  return fails + 1 >= LOGIN.maxFails;
}

/* ---------- OTP counters (max 5 wrong tries, 30 s resend) ---------- */

export function resendWaitSec(lastSentAtMs: number | null, now: number): number {
  if (lastSentAtMs === null) return 0;
  return Math.max(0, Math.ceil((OTP.resendSec * 1000 - (now - lastSentAtMs)) / 1000));
}

export function afterWrongCode(attempts: number): { attempts: number; left: number; locked: boolean } {
  const next = Math.min(attempts + 1, OTP.maxAttempts);
  const left = OTP.maxAttempts - next;
  return { attempts: next, left, locked: left <= 0 };
}
