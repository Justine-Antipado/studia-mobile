// Phase 7: the security hub. Cards for the four sub-pages come from
// navigation.js's own children list (childrenFor), so adding a fourth
// sub-page only means editing navigation.js, not this file too.
import { Link } from 'react-router-dom';
import * as securityRepo from '../data/securityRepository';
import { childrenFor } from '../../../core/config/navigation';
import { ROUTES } from '../../../core/config/routes';
import EmptyState from '../../../shared/components/EmptyState';
import { getIcon } from '../../../shared/components/Icon';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonCards } from '../../../shared/components/Skeleton';
import StatCard from '../../../shared/components/StatCard';
import { useAsync } from '../../../shared/hooks';

const CHILDREN = childrenFor(ROUTES.security);

export default function SecurityCenter() {
  const { data, error, loading, reload } = useAsync(
    async (signal) => {
      const [sessions, attempts] = await Promise.all([
        securityRepo.getSessions({ signal }),
        securityRepo.getLoginAttempts({ page: 1, pageSize: 5, filters: { result: 'Failed' } }, { signal }),
      ]);
      return { sessions, attempts };
    },
    []
  );

  return (
    <>
      <PageHeader title="Security center" subtitle="Audit log, sessions and login attempts." />

      {loading && <SkeletonCards count={2} />}

      {!loading && error && (
        <EmptyState
          tone="error"
          title="Security overview could not load"
          message={error.message}
          action={
            <button type="button" className="btn btn-primary" onClick={reload}>
              Try again
            </button>
          }
        />
      )}

      {!loading && !error && data && (
        <div className="stat-grid stat-grid-2">
          <StatCard label="Active sessions" value={data.sessions.length} />
          <StatCard label="Failed logins" value={data.attempts.meta.total} />
        </div>
      )}

      <div className="hub-grid">
        {CHILDREN.map((child) => {
          const ChildIcon = getIcon(child.icon ?? 'Shield');
          return (
            <Link key={child.path} to={child.path} className="hub-card">
              <span className="hub-card-icon">
                <ChildIcon />
              </span>
              <span className="hub-card-text">
                <strong>{child.label}</strong>
                <p>{child.description}</p>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
