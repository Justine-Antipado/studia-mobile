/**
 * REMOTE AUTH — admin login/logout against Supabase Auth through studia-api.
 *
 * Same method names and return shape as mockBackend.login/logout, and the same ApiError, so the
 * Login page and AuthContext do not change.
 *
 *  - The password check, 5-fails/1-min lockout, role=admin gate and audit_log entry all happen in
 *    studia-api (POST /api/auth/login with role "admin"). The browser only holds the result.
 *  - Session: supabase-js keeps it in localStorage (auto-refresh). A cross-site httpOnly cookie is not
 *    possible while the admin site and studia-api live on different Vercel domains; keep a strict CSP.
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
    default:
      return new ApiError({ status: status >= 500 ? 500 : status, code: status >= 500 ? ERROR_CODES.server : ERROR_CODES.unknown });
  }
}

async function postLogin(identifier, password) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${env.apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier, password, role: 'admin' }),
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
  if (!res.ok || !body?.session) throw toApiError(res.status, body);
  return body;
}

export const remoteAuth = {
  async login(identifier, password) {
    const { session, profile } = await postLogin(String(identifier).trim(), password);
    const { error } = await getSupabase().auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });
    if (error) throw new ApiError({ code: ERROR_CODES.unknown });
    return {
      token: session.accessToken,
      admin: { id: profile.id, name: profile.fullName, email: profile.email, username: 'admin', role: 'Admin' },
    };
  },

  /** Revokes this browser's session on the server; the local copy is removed even if that call fails. */
  async logout() {
    try {
      await getSupabase().auth.signOut({ scope: 'local' });
    } catch {
      /* offline: AuthContext clears the local session regardless */
    }
    return true;
  },

};
