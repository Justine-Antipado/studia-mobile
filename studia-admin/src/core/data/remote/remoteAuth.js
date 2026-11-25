/**
 * REMOTE AUTH — admin login/logout against Supabase Auth through studia-api.
 *
 * Same ApiError as every other data module, so the Login page and AuthContext stay simple.
 *
 *  - The password check, 5-fails/1-min lockout, role=admin gate and audit_log entry all happen in
 *    studia-api (POST /api/auth/login with role "admin"). The browser only holds the result.
 *  - TWO STEPS. A correct password returns { otpRequired } and emails a 6-digit code; studia-api
 *    discards the session Supabase minted for the password, so the browser cannot be signed in by a
 *    password alone. verifyLoginOtp exchanges the code for the real session (purpose "admin_login",
 *    migrations 036-037). This account can read every user's record and delete users and classes, so
 *    it is the last thing in the system that should rest on one secret.
 *  - Session: supabase-js keeps it in localStorage (auto-refresh) once the code is verified. A
 *    cross-site httpOnly cookie is not possible while the admin site and studia-api live on different
 *    Vercel domains, so the CSP in vercel.json names its connect-src hosts to limit what an injected
 *    script could do with those tokens.
 *  - Admin Google sign-in is NOT wired: the Login page has no Google button (UI change needed first).
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env';
import { ApiError, ERROR_CODES } from '../http/errors';

const TIMEOUT_MS = 20_000;
const GENERIC = 'Those credentials do not match an administrator account.';

let client = null;
export function getSupabase() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new ApiError({ code: ERROR_CODES.unknown, message: 'Supabase is not configured for this build.' });
  }
  client ??= createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'studia-admin-auth' },
  });
  return client;
}

function toApiError(status, body) {
  const e = body?.error ?? {};
  const retryAfterSec = e.retryAfterSec;
  switch (e.code) {
    case 'RATE_LIMITED':
      return new ApiError({ status: 429, code: ERROR_CODES.rateLimited, message: 'Too many failed attempts. Please wait before trying again.', meta: { retryAfterSec } });
    case 'INVALID_CREDENTIALS':
    case 'ROLE_MISMATCH': // never reveal that the account exists but is not an admin
      return new ApiError({ status: 401, code: ERROR_CODES.unauthorized, message: GENERIC });
    case 'ACCOUNT_INACTIVE':
    case 'ACCOUNT_PENDING':
      return new ApiError({ status: 403, code: ERROR_CODES.forbidden, message: e.message });
    case 'VALIDATION':
      return new ApiError({ status: 400, code: ERROR_CODES.validation, message: e.message, fieldErrors: e.fields ?? {} });
    // The sign-in code: the server's wording already says how many tries are left, or to start again.
    case 'OTP_INVALID':
    case 'OTP_EXPIRED':
      return new ApiError({ status: 400, code: ERROR_CODES.validation, message: e.message });
    case 'OTP_LOCKED':
      return new ApiError({ status: 429, code: ERROR_CODES.rateLimited, message: e.message, meta: { retryAfterSec } });
    default:
      return new ApiError({ status: status >= 500 ? 500 : status, code: status >= 500 ? ERROR_CODES.server : ERROR_CODES.unknown });
  }
}

/** POST to studia-api and return the parsed body, or throw the portal's ApiError. */
async function post(path, payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${env.apiUrl}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new ApiError({ code: err?.name === 'AbortError' ? ERROR_CODES.timeout : ERROR_CODES.network });
  } finally {
    clearTimeout(timer);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) throw toApiError(res.status, body);
  return body ?? {};
}

/** Hands the verified session to supabase-js, which every admin_* call then runs as. */
async function openSession({ session, profile }) {
  const { error } = await getSupabase().auth.setSession({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });
  if (error) throw new ApiError({ code: ERROR_CODES.unknown });
  return {
    token: session.accessToken,
    admin: { id: profile.id, name: profile.fullName, email: profile.email, username: 'admin', role: 'Admin' },
  };
}

export const remoteAuth = {
  /**
   * Does this browser still hold a Supabase session? The portal's own "signed in" marker can outlive it
   * (older login, cleared storage, revoked refresh token); every database call would then run as anon.
   * Returns true when it cannot tell (not configured), so a configuration problem never logs anyone out.
   */
  async hasSession() {
    try {
      const { data } = await getSupabase().auth.getSession();
      return !!data.session;
    } catch {
      return true;
    }
  },

  /**
   * Step one. A correct password does NOT open a session: studia-api throws away the session Supabase
   * minted for it and emails a 6-digit code, so what comes back here is what the OTP form needs.
   * `pendingToken` is the address the code went to, echoed back for step two.
   */
  async login(identifier, password) {
    const body = await post('login', { identifier: String(identifier).trim(), password, role: 'admin' });
    if (body.otpRequired) {
      return {
        otpRequired: true,
        pendingToken: body.pendingToken,
        maskedEmail: body.maskedEmail,
        expiresInSec: body.expiresInSec,
        resendInSec: body.resendInSec,
      };
    }
    // No code required (an account or deployment without the second factor).
    if (!body.session) throw toApiError(200, body);
    return openSession(body);
  },

  /** Step two: the code is what actually opens the session. */
  async verifyLoginOtp(pendingToken, code) {
    const body = await post('otp-verify', {
      email: pendingToken,
      purpose: 'admin_login',
      code: String(code).trim(),
    });
    if (!body.session) throw toApiError(200, body);
    return openSession(body);
  },

  async resendLoginOtp(pendingToken) {
    const body = await post('otp-send', { email: pendingToken, purpose: 'admin_login' });
    return { expiresInSec: body.expiresInSec, resendInSec: body.resendInSec };
  },

  async logout() {
    try {
      await getSupabase().auth.signOut({ scope: 'local' });
    } catch {
      /* offline: AuthContext clears the local session regardless */
    }
    return true;
  },

};
