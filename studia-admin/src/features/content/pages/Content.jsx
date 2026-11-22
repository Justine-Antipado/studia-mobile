// Phase 5: the materials library across every class — video, PDF and slide
// lessons with their processing status, size and owner. Delete only; there is
// no upload or edit here, lessons are created from the instructor's app.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as contentRepo from '../data/contentRepository';
import { path, ROUTES } from '../../../core/config/routes';
import { formatBytes, formatDate } from '../../../core/logic/format';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { ActionButton, ActionRow } from '../../../shared/components/ActionButton';
import Select from '../../../shared/components/Select';
import DataTable from '../../../shared/components/DataTable';
import EmptyState from '../../../shared/components/EmptyState';
import { Icon } from '../../../shared/components/Icon';
import Pager from '../../../shared/components/Pager';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonTable } from '../../../shared/components/Skeleton';
import { Badge, Card, Toast } from '../../../shared/components/ui';
import { useAsync, usePagination, useQueryState, useToast } from '../../../shared/hooks';

const PAGE_SIZE = 10;
const KINDS = ['video', 'pdf', 'slide'];
const STATUS_OPTIONS = [
  { value: 'Ready', label: 'Ready', dot: 'green' },
  { value: 'Processing', label: 'Processing', dot: 'amber' },
  { value: 'Failed', label: 'Failed', dot: 'red' },
];
const DEFAULTS = { page: 1, sort: 'postedAt', order: 'desc', q: '', kind: 'All', status: 'All' };
const RESET_PAGE_ON = ['q', 'kind', 'status'];

export default function Content() {
  const navigate = useNavigate();
  const [query, setQuery] = useQueryState(DEFAULTS, { resetPageOn: RESET_PAGE_ON });
  const [selected, setSelected] = useState(new Set());
  const [deleteIds, setDeleteIds] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast, showToast, showError, clearToast } = useToast();

  const params = useMemo(
    () => ({
      page: query.page,
      pageSize: PAGE_SIZE,
      sort: query.sort,
      order: query.order,
      q: query.q,
      filters: { kind: query.kind, processing: query.status },
    }),
    [query]
  );

  const { data, error, loading, reload } = useAsync(
    (signal) => contentRepo.getContent(params, { signal }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(params)]
  );

  const rows = data?.data ?? [];
  const pagination = usePagination({ page: query.page, pageSize: PAGE_SIZE, total: data?.meta.total ?? 0 });
  const selectedRows = rows.filter((m) => selected.has(m.id));
  const deleteTargets = rows.filter((m) => deleteIds?.includes(m.id));

  const runDelete = async () => {
    if (!deleteIds?.length) return;
    setBusy(true);
    try {
      await contentRepo.deleteContent(deleteIds);
      showToast(`${deleteIds.length} item${deleteIds.length === 1 ? '' : 's'} deleted.`);
      setSelected((prev) => {
        const next = new Set(prev);
        deleteIds.forEach((id) => next.delete(id));
        return next;
      });
      setDeleteIds(null);
      reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Material',
      sortable: true,
      primary: true,
      render: (m) => (
        <div>
          <strong>{m.title}</strong>
          <div className="muted small">{m.className}</div>
        </div>
      ),
    },
    { key: 'kind', header: 'Type', render: (m) => <Badge tone="lav">{m.kind}</Badge> },
    { key: 'processing', header: 'Status', sortable: true, render: (m) => <Badge>{m.processing}</Badge> },
    { key: 'ownerName', header: 'Owner', sortable: true },
    { key: 'sizeBytes', header: 'Size', sortable: true, render: (m) => formatBytes(m.sizeBytes) },
    { key: 'postedAt', header: 'Posted', sortable: true, render: (m) => formatDate(m.postedAt) },
  ];

  return (
    <>
      <PageHeader
        title="Content library"
        subtitle="Lesson videos, PDFs and slides across every class. Lessons are uploaded from the instructor's app, so this page is read and delete only."
        actions={
          <button
            type="button"
            className="btn btn-red"
            disabled={!selectedRows.length || busy}
            onClick={() => setDeleteIds(selectedRows.map((m) => m.id))}
          >
            <Icon.Trash /> Delete ({selectedRows.length})
          </button>
        }
      />

      <div className="filters">
        <label className="field search">
          <span>Search</span>
          <input
            className="input"
            value={query.q}
            placeholder="Title, class or owner"
            onChange={(e) => setQuery({ q: e.target.value })}
          />
        </label>
        <div className="field">
          <span>Type</span>
          <Select
            label="Type"
            value={query.kind}
            options={[{ value: 'All', label: 'All types' }, ...KINDS.map((k) => ({ value: k, label: k }))]}
            onChange={(kind) => setQuery({ kind })}
          />
        </div>
        <div className="field">
          <span>Status</span>
          <Select
            label="Status"
            value={query.status}
            options={[{ value: 'All', label: 'All statuses' }, ...STATUS_OPTIONS]}
            onChange={(status) => setQuery({ status })}
          />
        </div>
      </div>

      <Card>
        {loading && <SkeletonTable rows={6} cols={6} />}

        {!loading && error && (
          <EmptyState
            tone="error"
            title="Content could not load"
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
              selectable
              selectedIds={selected}
              onSelectedChange={setSelected}
              rowLabel={(m) => m.title}
              onRowClick={(m) => navigate(path(ROUTES.classDetail, { id: m.classId }))}
              caption="Content library"
              emptyTitle="No materials found"
              emptyMessage="Try a different filter or search term."
              renderActions={(m) => (
                <ActionRow>
                  <ActionButton
                    icon="Classes"
                    label="Open class"
                    tone="primary"
                    to={path(ROUTES.classDetail, { id: m.classId })}
                  />
                  <ActionButton icon="Trash" label="Delete" tone="danger" onClick={() => setDeleteIds([m.id])} />
                </ActionRow>
              )}
            />
            {rows.length > 0 && <Pager pagination={pagination} onPageChange={(page) => setQuery({ page })} />}
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteIds}
        title={`Delete ${deleteIds?.length ?? 0} item${(deleteIds?.length ?? 0) === 1 ? '' : 's'}?`}
        confirmWord="DELETE"
        confirmLabel="Delete permanently"
        busy={busy}
        onConfirm={runDelete}
        onClose={() => setDeleteIds(null)}
      >
        {deleteTargets.length === 1 ? (
          <>
            <b>{deleteTargets[0].title}</b> will be
          </>
        ) : (
          `${deleteIds?.length ?? 0} materials will be`
        )}{' '}
        permanently removed from the library. This cannot be undone.
      </ConfirmDialog>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
