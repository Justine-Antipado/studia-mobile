// Security overview tab: the headline login numbers.
import * as securityRepo from '../data/securityRepository';
import EmptyState from '../../../shared/components/EmptyState';
import { SkeletonCards } from '../../../shared/components/Skeleton';
import StatCard from '../../../shared/components/StatCard';
import { useAsync } from '../../../shared/hooks';

export default function SecurityOverview() {
  const { data, error, loading, reload } = useAsync(
    async (signal) => {
      const [failed, locked] = await Promise.all([
        securityRepo.getLoginAttempts({ page: 1, pageSize: 1, filters: { result: 'Failed' } }, { signal }),
        securityRepo.getLoginAttempts({ page: 1, pageSize: 1, filters: { result: 'Locked' } }, { signal }),
      ]);
      return { failed, locked };
    },
    []
  );

  return (
    <>
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
          <StatCard label="Failed logins" value={data.failed.meta.total} />
          <StatCard label="Lockouts" value={data.locked.meta.total} tone={data.locked.meta.total ? 'warn' : 'default'} />
        </div>
      )}
    </>
  );
}
