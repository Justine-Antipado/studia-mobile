import { Link } from 'react-router-dom';
import { ROUTES } from '../../../core/config/routes';
import { env } from '../../../core/config/env';
import { useDocumentTitle } from '../../../shared/hooks';
import EmptyState from '../../../shared/components/EmptyState';
import { useAuth } from '../../auth/hooks/useAuth';

export default function Forbidden() {
  const { logout } = useAuth();
  useDocumentTitle(`No access · ${env.appName}`, 'This account cannot open that page.');

  return (
    <div className="error-page">
      <p className="error-code">403</p>
      <EmptyState
        headingLevel={1}
        title="This account can't open that page"
        message="The admin portal is limited to the administrator account. If you believe this is wrong, sign in again with the administrator credentials."
        action={
          <div className="empty-buttons">
            <Link className="btn btn-primary" to={ROUTES.dashboard}>
              Back to the dashboard
            </Link>
            <Link className="btn btn-ghost" to={ROUTES.login} onClick={logout}>
              Sign in as administrator
            </Link>
          </div>
        }
      />
    </div>
  );
}
