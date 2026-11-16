import { createContext, useContext, useState, useCallback } from 'react';
import * as api from '../services/api';

const AuthContext = createContext(null);
const KEY = 'studia_admin_session';

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);

  const login = useCallback(async (identifier, password) => {
    const result = await api.login(identifier, password);
    localStorage.setItem(KEY, JSON.stringify(result));
    setSession(result);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ admin: session?.admin ?? null, isAuthed: !!session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
