// auth-validation.ts
// Pure functions, no React. The mock service re-runs these so that "client-side only"
// validation never becomes the only line of defence. Port the same rules to the backend.

import type { Role } from "@/core/types/role";
export type { Role };

export type FieldKey =
  | "fullName"
  | "course"
  | "year"
  | "section"
  | "department"
  | "email"
  | "phone"
  | "password"
  | "confirm";

export type FieldErrors = Partial<Record<FieldKey, string>>;

export const LIMITS = { name: 80, email: 254, password: 64 } as const;

/* ---------- Dropdown options ---------- */

export const COURSES = ["BSIT", "BEED", "BSBA-FM", "BSBA-OM"] as const;
export const YEARS = ["1", "2", "3", "4"] as const;
export const SECTIONS = ["A", "B", "C", "D", "E"] as const;
export const DEPARTMENTS = ["FM", "OM", "IT", "ED"] as const;

/** "BSIT" + "3" + "A" -> "BSIT 3-A" (same format as before, so the DB stays compatible) */
export const composeSection = (course = "", year = "", section = "") =>
  `${course} ${year}-${section}`;

const oneOf = (list: readonly string[], v: string) => list.includes(v);

/* ---------- Normalizers (always run these before saving / comparing) ---------- */

export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const normalizeName = (v: string) => v.trim().replace(/\s+/g, " ");

/** Returns "+639XXXXXXXXX", "" (empty / not provided) or null (invalid). */
export function normalizePhone(v: string): string | null {
  const c = v.replace(/[\s-]/g, "");
  if (!c) return "";
  if (/^09\d{9}$/.test(c)) return `+63${c.slice(1)}`;
  if (/^\+639\d{9}$/.test(c)) return c;
  return null;
}

/* ---------- Password strength ---------- */

export const PASSWORD_RULES = [
  {
    id: "len",
    label: "At least 8 characters",
    test: (p: string) => p.length >= 8,
  },
  {
    id: "lower",
    label: "One lowercase letter",
    test: (p: string) => /[a-z]/.test(p),
  },
  {
    id: "upper",
    label: "One uppercase letter",
    test: (p: string) => /[A-Z]/.test(p),
  },
  { id: "num", label: "One number", test: (p: string) => /\d/.test(p) },
  {
    id: "sym",
    label: "One symbol (e.g. ! @ # $)",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
] as const;

export const passwordScore = (p: string) =>
  PASSWORD_RULES.filter((r) => r.test(p)).length;

export const isStrongPassword = (p: string) =>
  p.length <= LIMITS.password && passwordScore(p) === PASSWORD_RULES.length;

/* ---------- Field rules ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Explicit ranges instead of \p{L}: avoids relying on Unicode property escapes in Hermes.
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]{1,79}$/;

export const isEmail = (v: string) =>
  v.length <= LIMITS.email && EMAIL_RE.test(v);
export const isOtp = (v: string) => /^\d{6}$/.test(v);

/** New accounts must use Gmail (server hook, migration 010). Only sign-up applies this. */
export const isGmail = (v: string) => /^[a-z0-9._+-]{1,64}@gmail\.com$/.test(v);

type Ctx = {
  role: Role;
  /** Needed to validate "confirm". */
  password?: string;
  /** true on sign-up only: a NEW account must use a @gmail.com address. */
  gmailOnly?: boolean;
  /** false on the login screen: we only check "not empty", never reveal password rules. */
  strict?: boolean;
};

export function validateField(
  key: FieldKey,
  raw: string,
  ctx: Ctx,
): string | null {
  const strict = ctx.strict ?? true;
  switch (key) {
    case "fullName": {
      const v = normalizeName(raw);
      if (!v) return "Full name is required.";
      return NAME_RE.test(v) ? null : "Use letters only (2 to 80 characters).";
    }
    case "course":
      return oneOf(COURSES, raw) ? null : "Select your course.";
    case "year":
      return oneOf(YEARS, raw) ? null : "Select your year.";
    case "section":
      return oneOf(SECTIONS, raw) ? null : "Select your section.";
    case "department":
      return oneOf(DEPARTMENTS, raw) ? null : "Select your department.";
    case "email": {
      const v = normalizeEmail(raw);
      if (!v) return "Email is required.";
      if (!isEmail(v)) return "Enter a valid email address.";
      return ctx.gmailOnly && !isGmail(v) ? "Use a Gmail address (you@gmail.com)." : null;
    }
    case "phone":
      return normalizePhone(raw) === null
        ? "Use a PH mobile number, e.g. 09123456789."
        : null;
    case "password": {
      if (!raw) return "Password is required.";
      if (raw.length > LIMITS.password)
        return `Password is too long (max ${LIMITS.password}).`;
      if (strict && !isStrongPassword(raw))
        return "Password does not meet all requirements.";
      return null;
    }
    case "confirm": {
      if (!raw) return "Please confirm your password.";
      return raw === (ctx.password ?? "") ? null : "Passwords do not match.";
    }
  }
}

export function validateAll(
  keys: readonly FieldKey[],
  values: Partial<Record<FieldKey, string>>,
  ctx: Ctx,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const k of keys) {
    const msg = validateField(k, values[k] ?? "", {
      ...ctx,
      password: values.password ?? ctx.password,
    });
    if (msg) errors[k] = msg;
  }
  return errors;
}
