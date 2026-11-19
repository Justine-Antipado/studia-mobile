import { useContext } from 'react';
import { AuthContext } from '../context/auth-context';

/** The admin session: { admin, isAuthed, isAdmin, login, logout }. */
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
