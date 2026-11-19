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

  const login = useCallback(async (identifier, password) => {
    const result = await api.login(identifier, password);
    setSession({ token: result.token, admin: result.admin });
    return result.admin;
  }, []);

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
      logout,
    };
  }, [session, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
