// Class announcements: the stream instructors post inside a class in the mobile app
// (public.announcements + announcement_comments). Like the rest of Academics this is read and
// delete only; the admin moderates, the instructor writes.
import { useMemo, useState } from 'react';
import * as announcementsRepo from '../data/announcementsRepository';
import AnnouncementDetailModal from '../components/AnnouncementDetailModal';
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
const DEFAULTS = { page: 1, sort: 'postedAt', order: 'desc', q: '', pinned: 'All' };
const RESET_PAGE_ON = ['q', 'pinned'];

export default function Announcements() {
  const [query, setQuery] = useQueryState(DEFAULTS, { resetPageOn: RESET_PAGE_ON });
  const [selected, setSelected] = useState(new Set());
  const [deleteIds, setDeleteIds] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [viewing, setViewing] = useState(null);
  const { toast, showToast, showError, clearToast } = useToast();

  const params = useMemo(
    () => ({
      page: query.page,
      pageSize: PAGE_SIZE,
      sort: query.sort,
      order: query.order,
      q: query.q,
      filters: { pinned: query.pinned },
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
      key: 'className',
      header: 'Class',
      render: (a) => (
        <div>
          {a.className}
          <div className="muted small">{a.sectionLabel}</div>
        </div>
      ),
    },
    { key: 'authorName', header: 'Posted by', render: (a) => a.authorName },
    { key: 'pinned', header: 'Pinned', render: (a) => (a.pinned ? <Badge tone="lav">Pinned</Badge> : <span className="muted">—</span>) },
    { key: 'commentCount', header: 'Comments', render: (a) => a.commentCount },
    { key: 'postedAt', header: 'Posted', sortable: true, render: (a) => formatDateTime(a.postedAt) },
  ];

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Class stream posts and their comments, as students and instructors see them in the mobile app. Read and delete only."
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
          </>
        }
      />

      <div className="filters">
        <label className="field search">
          <span>Search</span>
          <input
            className="input"
            value={query.q}
            placeholder="Title, message, class or instructor"
            onChange={(e) => setQuery({ q: e.target.value })}
          />
        </label>
        <div className="field">
          <span>Pinned</span>
          <Select
            label="Pinned"
            value={query.pinned}
            options={[
              { value: 'All', label: 'All posts' },
              { value: 'Pinned', label: 'Pinned only' },
              { value: 'Unpinned', label: 'Not pinned' },
            ]}
            onChange={(pinned) => setQuery({ pinned })}
          />
        </div>
      </div>

      <Card>
        {loading && <SkeletonTable rows={6} cols={6} />}

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
              emptyMessage="Instructors post them inside their classes in the mobile app."
              renderActions={(a) => (
                <ActionRow>
                  <ActionButton icon="Eye" label="View" tone="primary" onClick={() => setViewing(a)} />
                  <ActionButton icon="Trash" label="Delete" tone="danger" onClick={() => setDeleteIds([a.id])} />
                </ActionRow>
              )}
            />
            {rows.length > 0 && <Pager pagination={pagination} onPageChange={(page) => setQuery({ page })} />}
          </>
        )}
      </Card>

      {viewing && <AnnouncementDetailModal announcement={viewing} onClose={() => setViewing(null)} />}

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
        permanently removed, together with their comments. This cannot be undone.
      </ConfirmDialog>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
