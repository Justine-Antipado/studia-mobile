import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../../../core/config/routes';
import { useAuth } from '../hooks/useAuth';

/**
 * Route guard: no session -> /login (remembering where you were heading);
 * a session that is not an admin -> /403. The server re-checks both on every
 * request — this only keeps the UI honest.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthed, isAdmin } = useAuth();
  const location = useLocation();

  if (!isAuthed) return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  if (!isAdmin) return <Navigate to={ROUTES.forbidden} replace />;
  return children;
}
