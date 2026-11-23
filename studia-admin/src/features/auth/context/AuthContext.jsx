import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../../../core/data/api';
import { clearSession, getSession, setSession, subscribe } from '../../../core/data/http/tokenStore';
import { AuthContext } from './auth-context';

/**
 * Holds the admin session. The token itself never comes near this file — it
 * lives in core/data/http/tokenStore.js, which also keeps other tabs in sync:
 * logging out in one tab logs out the rest.
 */
export function AuthProvider({ children }) {
  const [session, setLocalSession] = useState(getSession);

  useEffect(() => subscribe(setLocalSession), []);

  // The local "signed in" marker can outlive the Supabase session. Without one, database reads run as
  // anonymous and fail, so end the session and send the admin back to the login page.
  useEffect(() => {
    if (!getSession()) return;
    let cancelled = false;
    api.hasSupabaseSession().then((ok) => {
      if (!ok && !cancelled) clearSession();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Step one. A correct password does NOT create a session: the backend holds a
   * pending login and emails a code, and this returns what the OTP screen needs.
   */
  const login = useCallback(async (identifier, password) => {
    const result = await api.login(identifier, password);
    if (result?.otpRequired) return result;
    // A data source without the OTP step (or a future trusted-device path).
    setSession({ token: result.token, admin: result.admin });
    return result;
  }, []);

  /** Step two: the code is what actually opens the session. */
  const verifyOtp = useCallback(async (pendingToken, code) => {
    const result = await api.verifyLoginOtp(pendingToken, code);
    setSession({ token: result.token, admin: result.admin });
    return result.admin;
  }, []);

  const resendOtp = useCallback((pendingToken) => api.resendLoginOtp(pendingToken), []);

  const logout = useCallback(() => {
    // Fire-and-forget: the session is gone locally even if the call fails.
    api.logout?.().catch(() => {});
    clearSession();
  }, []);

  const value = useMemo(() => {
    const admin = session?.admin ?? null;
    return {
      admin,
      isAuthed: !!session,
      // The portal has exactly one role. Kept explicit so ProtectedRoute can
      // check it the same way it will against a real JWT claim.
      isAdmin: !!admin && (admin.role ?? 'Admin') === 'Admin',
      login,
      verifyOtp,
      resendOtp,
      logout,
    };
  }, [session, login, verifyOtp, resendOtp, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
