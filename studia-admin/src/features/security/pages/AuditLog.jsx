// Phase 7: who did what, and when. Every delete and write this admin
// performs is written to audit_log by the database functions (migration 025).
import { useMemo } from 'react';
import * as securityRepo from '../data/securityRepository';
import { formatDateTime } from '../../../core/logic/format';
import DateField from '../../../shared/components/DateField';
import Select from '../../../shared/components/Select';
import DataTable from '../../../shared/components/DataTable';
import { Icon } from '../../../shared/components/Icon';
import Pager from '../../../shared/components/Pager';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonTable } from '../../../shared/components/Skeleton';
import { Badge, Card } from '../../../shared/components/ui';
import EmptyState from '../../../shared/components/EmptyState';
import { useAsync, usePagination, useQueryState } from '../../../shared/hooks';
import { downloadCsv } from '../../../shared/utils/csv';

const ACTIONS = [
  { value: 'delete', label: 'Delete', tone: 'red' },
  { value: 'create', label: 'Create', tone: 'green' },
  { value: 'update', label: 'Update', tone: 'blue' },
  { value: 'settings', label: 'Settings', tone: 'grey' },
  { value: 'security', label: 'Security', tone: 'orange' },
];
const ACTION_TONE = Object.fromEntries(ACTIONS.map((a) => [a.value, a.tone]));
const PAGE_SIZE = 10;

const DEFAULTS = { page: 1, sort: 'at', order: 'desc', q: '', action: 'All', from: '', to: '' };
const RESET_PAGE_ON = ['q', 'action', 'from', 'to'];

export default function AuditLog() {
  const [query, setQuery] = useQueryState(DEFAULTS, { resetPageOn: RESET_PAGE_ON });

  const params = useMemo(
    () => ({
      page: query.page,
      pageSize: PAGE_SIZE,
      sort: query.sort,
      order: query.order,
      q: query.q,
      filters: { action: query.action, from: query.from, to: query.to },
    }),
    [query]
  );

  const { data, error, loading, reload } = useAsync(
    (signal) => securityRepo.getAuditLog(params, { signal }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(params)]
  );

  const rows = data?.data ?? [];
  const pagination = usePagination({ page: query.page, pageSize: PAGE_SIZE, total: data?.meta.total ?? 0 });

  const exportCsv = () =>
    downloadCsv(
      'studia-audit-log.csv',
      ['When', 'Actor', 'Action', 'Summary'],
      rows.map((r) => [formatDateTime(r.at), r.actor, r.action, r.summary])
    );

  const columns = [
    { key: 'at', header: 'When', sortable: true, primary: true, render: (r) => formatDateTime(r.at) },
    { key: 'actor', header: 'Actor', render: (r) => r.actor },
    { key: 'action', header: 'Action', render: (r) => <Badge tone={ACTION_TONE[r.action]}>{ACTIONS.find((a) => a.value === r.action)?.label ?? r.action}</Badge> },
    { key: 'summary', header: 'Summary', render: (r) => r.summary },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every action this admin account performs, read-only."
       
        actions={
          <button type="button" className="btn btn-ghost" disabled={!rows.length} onClick={exportCsv}>
            <Icon.Download /> Export CSV
          </button>
        }
      />

      <div className="filters">
        <label className="field search">
          <span>Search</span>
          <input className="input" value={query.q} placeholder="Actor or summary" onChange={(e) => setQuery({ q: e.target.value })} />
        </label>
        <div className="field">
          <span>Action</span>
          <Select
            label="Action"
            searchable
            value={query.action}
            options={[{ value: 'All', label: 'All actions' }, ...ACTIONS]}
            onChange={(action) => setQuery({ action })}
          />
        </div>
        <div className="field">
          <span>From</span>
          <DateField label="From" placeholder="Any date" value={query.from} onChange={(from) => setQuery({ from })} />
        </div>
        <div className="field">
          <span>To</span>
          <DateField label="To" placeholder="Any date" value={query.to} onChange={(to) => setQuery({ to })} />
        </div>
      </div>

      <Card>
        {loading && <SkeletonTable rows={6} cols={4} />}

        {!loading && error && (
          <EmptyState
            tone="error"
            title="Audit log could not load"
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
              sort={{ key: query.sort, order: query.order }}
              onSortChange={({ key, order }) => setQuery({ sort: key, order })}
              rowLabel={(r) => r.summary}
              caption="Audit log"
              emptyTitle="No matching activity"
              emptyMessage="Try a different filter, search term or date range."
            />
            {rows.length > 0 && <Pager pagination={pagination} onPageChange={(page) => setQuery({ page })} />}
          </>
        )}
      </Card>
    </>
  );
}
