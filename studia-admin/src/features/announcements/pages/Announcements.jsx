// Phase 5: platform-wide notices. The one area where admin may create
// content — everything else in Academics is read and delete only. The create
// form lives in components/CreateAnnouncementModal.jsx (house rule: ~250 lines).
import { useMemo, useState } from 'react';
import * as announcementsRepo from '../data/announcementsRepository';
import CreateAnnouncementModal from '../components/CreateAnnouncementModal';
import { AUDIENCE_LABELS } from '../logic/constants';
import { formatDateTime } from '../../../core/logic/format';
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
const DEFAULTS = { page: 1, sort: 'createdAt', order: 'desc', q: '', audience: 'All', status: 'All' };
const RESET_PAGE_ON = ['q', 'audience', 'status'];

export default function Announcements() {
  const [query, setQuery] = useQueryState(DEFAULTS, { resetPageOn: RESET_PAGE_ON });
  const [selected, setSelected] = useState(new Set());
  const [deleteIds, setDeleteIds] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { toast, showToast, showError, clearToast } = useToast();

  const params = useMemo(
    () => ({
      page: query.page,
      pageSize: PAGE_SIZE,
      sort: query.sort,
      order: query.order,
      q: query.q,
      filters: { audience: query.audience, status: query.status },
    }),
    [query]
  );

  const { data, error, loading, reload } = useAsync(
    (signal) => announcementsRepo.getAnnouncements(params, { signal }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(params)]
  );

  const rows = data?.data ?? [];
  const pagination = usePagination({ page: query.page, pageSize: PAGE_SIZE, total: data?.meta.total ?? 0 });
  const selectedRows = rows.filter((a) => selected.has(a.id));
  const deleteTargets = rows.filter((a) => deleteIds?.includes(a.id));

  const onCreated = () => {
    setCreateOpen(false);
    showToast('Announcement posted.');
    reload();
  };

  const runDelete = async () => {
    if (!deleteIds?.length) return;
    setDeleteBusy(true);
    try {
      await announcementsRepo.deleteAnnouncements(deleteIds);
      showToast(`${deleteIds.length} announcement${deleteIds.length === 1 ? '' : 's'} deleted.`);
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
      setDeleteBusy(false);
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Announcement',
      sortable: true,
      primary: true,
      render: (a) => (
        <div>
          <strong>{a.title}</strong>
          <div className="muted small">{a.body.length > 90 ? `${a.body.slice(0, 90)}…` : a.body}</div>
        </div>
      ),
    },
    {
      key: 'audience',
      header: 'Audience',
      render: (a) => (
        <Badge tone="lav">{AUDIENCE_LABELS[a.audience]}{a.audience === 'course' ? ` · ${a.course}` : ''}</Badge>
      ),
    },
    { key: 'status', header: 'Status', sortable: true, render: (a) => <Badge>{a.status}</Badge> },
    {
      key: 'when',
      header: 'When',
      render: (a) => formatDateTime(a.status === 'Scheduled' ? a.scheduledAt : a.publishedAt),
    },
    { key: 'createdAt', header: 'Created', sortable: true, render: (a) => formatDateTime(a.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="System-wide notices for students and instructors. The one area of Academics where the admin may create content."
        actions={
          <>
            <button
              type="button"
              className="btn btn-red"
              disabled={!selectedRows.length || deleteBusy}
              onClick={() => setDeleteIds(selectedRows.map((a) => a.id))}
            >
              <Icon.Trash /> Delete ({selectedRows.length})
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <Icon.Megaphone /> New announcement
            </button>
          </>
        }
      />

      <div className="filters">
        <label className="field search">
          <span>Search</span>
          <input
            className="input"
            value={query.q}
            placeholder="Title or message"
            onChange={(e) => setQuery({ q: e.target.value })}
          />
        </label>
        <div className="field">
          <span>Audience</span>
          <Select
            label="Audience"
            value={query.audience}
            options={[
              { value: 'All', label: 'All audiences' },
              ...Object.entries(AUDIENCE_LABELS).map(([value, label]) => ({ value, label })),
            ]}
            onChange={(audience) => setQuery({ audience })}
          />
        </div>
        <div className="field">
          <span>Status</span>
          <Select
            label="Status"
            value={query.status}
            options={[
              { value: 'All', label: 'All statuses' },
              { value: 'Scheduled', label: 'Scheduled', dot: 'amber' },
              { value: 'Published', label: 'Published', dot: 'green' },
            ]}
            onChange={(status) => setQuery({ status })}
          />
        </div>
      </div>

      <Card>
        {loading && <SkeletonTable rows={6} cols={5} />}

        {!loading && error && (
          <EmptyState
            tone="error"
            title="Announcements could not load"
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
              rowLabel={(a) => a.title}
              caption="Announcements"
              emptyTitle="No announcements yet"
              emptyMessage="Post the first system-wide notice."
              emptyAction={
                <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                  <Icon.Megaphone /> New announcement
                </button>
              }
              renderActions={(a) => (
                <ActionRow>
                  <ActionButton icon="Trash" label="Delete" tone="danger" onClick={() => setDeleteIds([a.id])} />
                </ActionRow>
              )}
            />
            {rows.length > 0 && <Pager pagination={pagination} onPageChange={(page) => setQuery({ page })} />}
          </>
        )}
      </Card>

      {createOpen && <CreateAnnouncementModal onClose={() => setCreateOpen(false)} onCreated={onCreated} />}

      <ConfirmDialog
        open={!!deleteIds}
        title={`Delete ${deleteIds?.length ?? 0} announcement${(deleteIds?.length ?? 0) === 1 ? '' : 's'}?`}
        confirmWord="DELETE"
        confirmLabel="Delete permanently"
        busy={deleteBusy}
        onConfirm={runDelete}
        onClose={() => setDeleteIds(null)}
      >
        {deleteTargets.length === 1 ? (
          <>
            <b>{deleteTargets[0].title}</b> will be
          </>
        ) : (
          `${deleteIds?.length ?? 0} announcements will be`
        )}{' '}
        permanently removed. This cannot be undone.
      </ConfirmDialog>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
