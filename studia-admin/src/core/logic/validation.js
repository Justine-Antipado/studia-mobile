/**
 * VALIDATION — JS port of studia-mobile/src/features/auth/logic/auth-validation.ts.
 * Keep the two in sync: both apps must agree, and the PHP backend must re-run
 * the same rules (the client is never the authority — see docs/api-contract.md).
 */
export const LIMITS = {
  name: 80,
  email: 254,
  password: 64,
  identifier: 254,
  search: 120,
  text: 20000,
  announcementTitle: 140,
  announcementBody: 4000,
};

export const COURSES = ['BSIT', 'BEED', 'BSBA-FM', 'BSBA-OM'];
export const YEARS = ['1', '2', '3', '4'];
export const SECTIONS = ['A', 'B', 'C', 'D', 'E'];
export const DEPARTMENTS = ['FM', 'OM', 'IT', 'ED'];
export const EMAIL_DOMAIN = 'omsu.edu.ph';

/** Each course belongs to one instructor department, so classes can be assigned a real instructor. */
export const DEPARTMENT_OF_COURSE = { BSIT: 'IT', BEED: 'ED', 'BSBA-FM': 'FM', 'BSBA-OM': 'OM' };

// Login throttling — same values as studia-mobile/src/features/auth/data/auth-service.ts
// (LOGIN_MAX_FAILS, LOGIN_LOCK_MS), so both apps lock an account the same way.
export const LOGIN_MAX_FAILS = 5;
export const LOGIN_LOCK_MS = 60_000;

/** 'BSIT' + '3' + 'A' -> 'BSIT 3-A' (same format the mobile app stores) */
export const composeSection = (course = '', year = '', section = '') => `${course} ${year}-${section}`;

const oneOf = (list, v) => list.includes(v);

/* ---------- Normalizers: run these before saving or comparing ---------- */

export const normalizeEmail = (v = '') => v.trim().toLowerCase();
export const normalizeName = (v = '') => v.trim().replace(/\s+/g, ' ');

/** '+639XXXXXXXXX', '' (not provided) or null (invalid). */
export function normalizePhone(v = '') {
  const c = v.replace(/[\s-]/g, '');
  if (!c) return '';
  if (/^09\d{9}$/.test(c)) return `+63${c.slice(1)}`;
  if (/^\+639\d{9}$/.test(c)) return c;
  return null;
}

/* ---------- Password strength ---------- */

export const PASSWORD_RULES = [
  { id: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'num', label: 'One number', test: (p) => /\d/.test(p) },
  { id: 'sym', label: 'One symbol (e.g. ! @ # $)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export const passwordScore = (p = '') => PASSWORD_RULES.filter((r) => r.test(p)).length;
export const isStrongPassword = (p = '') => p.length <= LIMITS.password && passwordScore(p) === PASSWORD_RULES.length;

/* ---------- Field rules ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]{1,79}$/;

export const isEmail = (v = '') => v.length <= LIMITS.email && EMAIL_RE.test(v);
export const isCampusEmail = (v = '') => isEmail(v) && normalizeEmail(v).endsWith(`@${EMAIL_DOMAIN}`);
export const isOtp = (v = '') => /^\d{6}$/.test(v);

/**
 * validateField(key, raw, ctx)
 * ctx.password is needed for 'confirm'; ctx.strict=false (login) only checks
 * that the field is filled in, so password rules are never leaked there.
 */
export function validateField(key, raw = '', ctx = {}) {
  const strict = ctx.strict ?? true;
  switch (key) {
    case 'fullName': {
      const v = normalizeName(raw);
      if (!v) return 'Full name is required.';
      return NAME_RE.test(v) ? null : 'Use letters only (2 to 80 characters).';
    }
    case 'course':
      return oneOf(COURSES, raw) ? null : 'Select a course.';
    case 'year':
      return oneOf(YEARS, raw) ? null : 'Select a year.';
    case 'section':
      return oneOf(SECTIONS, raw) ? null : 'Select a section.';
    case 'department':
      return oneOf(DEPARTMENTS, raw) ? null : 'Select a department.';
    case 'email': {
      const v = normalizeEmail(raw);
      if (!v) return 'Email is required.';
      return isEmail(v) ? null : 'Enter a valid email address.';
    }
    case 'campusEmail': {
      const v = normalizeEmail(raw);
      if (!v) return 'Email is required.';
      return isCampusEmail(v) ? null : `Use an @${EMAIL_DOMAIN} address.`;
    }
    case 'identifier': {
      const v = raw.trim();
      if (!v) return 'Enter your email or username.';
      return v.length <= LIMITS.identifier ? null : 'That is too long.';
    }
    case 'phone':
      return normalizePhone(raw) === null ? 'Use a PH mobile number, e.g. 09123456789.' : null;
    case 'password': {
      if (!raw) return 'Password is required.';
      if (raw.length > LIMITS.password) return `Password is too long (max ${LIMITS.password}).`;
      if (strict && !isStrongPassword(raw)) return 'Password does not meet all requirements.';
      return null;
    }
    case 'confirm': {
      if (!raw) return 'Please confirm your password.';
      return raw === (ctx.password ?? '') ? null : 'Passwords do not match.';
    }
    case 'otp': {
      if (!raw) return 'Enter the 6-digit code.';
      return isOtp(raw) ? null : 'The code is 6 digits.';
    }
    default:
      return null;
  }
}

/** validateAll(['email','password'], values, ctx) -> { email: '…' } */
export function validateAll(keys, values = {}, ctx = {}) {
  const errors = {};
  for (const k of keys) {
    const msg = validateField(k, values[k] ?? '', { ...ctx, password: values.password ?? ctx.password });
    if (msg) errors[k] = msg;
  }
  return errors;
}

/** Trim and hard-cap free text before it is sent or rendered. */
export const clampText = (v = '', max = LIMITS.text) => String(v).slice(0, max);

/** Strip control characters from a search term; the UI never builds HTML from input. */
export const sanitizeSearch = (v = '') =>
  /* eslint-disable-next-line no-control-regex */
  String(v).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, LIMITS.search);
