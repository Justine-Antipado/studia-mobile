// Phase 7: failed logins, lockouts and IP addresses. mockBackend.login()
// appends a real row here on every attempt, success or fail.
import { useMemo } from 'react';
import * as securityRepo from '../data/securityRepository';
import { ROUTES } from '../../../core/config/routes';
import { formatDateTime } from '../../../core/logic/format';
import DataTable from '../../../shared/components/DataTable';
import Pager from '../../../shared/components/Pager';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonTable } from '../../../shared/components/Skeleton';
import Tabs from '../../../shared/components/Tabs';
import { Badge, Card } from '../../../shared/components/ui';
import EmptyState from '../../../shared/components/EmptyState';
import { useAsync, usePagination, useQueryState } from '../../../shared/hooks';

const TABS = [
  { key: 'All', label: 'All' },
  { key: 'Success', label: 'Success' },
  { key: 'Failed', label: 'Failed' },
  { key: 'Locked', label: 'Locked' },
];
const PAGE_SIZE = 10;
const DEFAULTS = { page: 1, result: 'All', q: '' };
const RESET_PAGE_ON = ['result', 'q'];

const resultBadge = (a) => {
  if (a.locked) return <Badge tone="red">Locked</Badge>;
  return a.success ? <Badge tone="green">Success</Badge> : <Badge tone="orange">Failed</Badge>;
};

export default function LoginAttempts() {
  const [query, setQuery] = useQueryState(DEFAULTS, { resetPageOn: RESET_PAGE_ON });

  const params = useMemo(
    () => ({ page: query.page, pageSize: PAGE_SIZE, q: query.q, filters: { result: query.result } }),
    [query]
  );

  const { data, error, loading, reload } = useAsync(
    (signal) => securityRepo.getLoginAttempts(params, { signal }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(params)]
  );

  const rows = data?.data ?? [];
  const pagination = usePagination({ page: query.page, pageSize: PAGE_SIZE, total: data?.meta.total ?? 0 });

  const columns = [
    { key: 'at', header: 'When', primary: true, render: (a) => formatDateTime(a.at) },
    { key: 'identifier', header: 'Identifier used', render: (a) => a.identifier },
    { key: 'result', header: 'Result', render: resultBadge },
    { key: 'ip', header: 'IP address', render: (a) => a.ip },
  ];

  return (
    <>
      <PageHeader title="Login attempts" subtitle="Failed logins, lockouts and IP addresses." back={ROUTES.security} />

      <Tabs
        aria-label="Filter by result"
        items={TABS}
        value={query.result}
        onChange={(result) => setQuery({ result })}
        controls="login-attempts-results"
      />

      <div className="filters">
        <label className="field search">
          <span>Search</span>
          <input className="input" value={query.q} placeholder="Identifier or IP" onChange={(e) => setQuery({ q: e.target.value })} />
        </label>
      </div>

      <Card id="login-attempts-results" role="tabpanel" aria-labelledby={`tab-${query.result}`}>
        {loading && <SkeletonTable rows={6} cols={4} />}

        {!loading && error && (
          <EmptyState
            tone="error"
            title="Login attempts could not load"
            message={error.message}
            action={
              <button type="button" className="btn btn-primary" onClick={reload}>
                Try again
              </button>
            }
          />
        )}

        {!loading && !error && (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              rowLabel={(a) => `${a.identifier} from ${a.ip}`}
              caption="Login attempts"
              emptyTitle="No matching attempts"
              emptyMessage="Try a different filter or search term."
            />
            {rows.length > 0 && <Pager pagination={pagination} onPageChange={(page) => setQuery({ page })} />}
          </>
        )}
      </Card>
    </>
  );
}
