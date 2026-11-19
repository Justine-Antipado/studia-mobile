import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../../../core/config/routes';
import { useDocumentTitle } from '../../../shared/hooks';
import { env } from '../../../core/config/env';
import EmptyState from '../../../shared/components/EmptyState';

export default function NotFound() {
  const { pathname } = useLocation();
  useDocumentTitle(`Page not found · ${env.appName}`, 'The page you asked for does not exist.');

  return (
    <div className="error-page">
      <p className="error-code">404</p>
      <EmptyState
        headingLevel={1}
        title="We couldn't find that page"
        message={`Nothing is published at ${pathname}. It may have been renamed, or the link may be out of date.`}
        action={
          <div className="empty-buttons">
            <Link className="btn btn-primary" to={ROUTES.dashboard}>
              Go to the dashboard
            </Link>
            <Link className="btn btn-ghost" to={ROUTES.help}>
              Open the admin guide
            </Link>
          </div>
        }
      />
    </div>
  );
}
