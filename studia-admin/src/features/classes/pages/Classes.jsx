// Phase 5: every class created by an instructor, read-only except delete.
// Modelled on features/users/pages/Users.jsx — same DataTable + useQueryState
// + bulk/row ConfirmDialog pattern, so the two list pages behave identically.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as classesRepo from '../data/classesRepository';
import { path, ROUTES } from '../../../core/config/routes';
import { COURSES } from '../../../core/logic/validation';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import DataTable from '../../../shared/components/DataTable';
import EmptyState from '../../../shared/components/EmptyState';
import { Icon } from '../../../shared/components/Icon';
import Pager from '../../../shared/components/Pager';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonTable } from '../../../shared/components/Skeleton';
import { Badge, Card, Toast } from '../../../shared/components/ui';
import { useAsync, usePagination, useQueryState, useToast } from '../../../shared/hooks';

const PAGE_SIZE = 10;
const DEFAULTS = { page: 1, sort: 'title', order: 'asc', q: '', course: 'All', status: 'All' };
const RESET_PAGE_ON = ['q', 'course', 'status'];

export default function Classes() {
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
      filters: { course: query.course, archived: query.status === 'All' ? undefined : query.status === 'Archived' },
    }),
    [query]
  );

  const { data, error, loading, reload } = useAsync(
    (signal) => classesRepo.getClasses(params, { signal }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(params)]
  );

  const rows = data?.data ?? [];
  const pagination = usePagination({ page: query.page, pageSize: PAGE_SIZE, total: data?.meta.total ?? 0 });
  const selectedRows = rows.filter((c) => selected.has(c.id));
  const deleteTargets = rows.filter((c) => deleteIds?.includes(c.id));

  const runDelete = async () => {
    if (!deleteIds?.length) return;
    setBusy(true);
    try {
      await classesRepo.deleteClasses(deleteIds);
      showToast(`${deleteIds.length} class${deleteIds.length === 1 ? '' : 'es'} deleted.`);
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
      header: 'Class',
      sortable: true,
      primary: true,
      render: (c) => (
        <div>
          <strong>{c.title}</strong>
          <div className="muted small">{c.code}</div>
        </div>
      ),
    },
    { key: 'instructorName', header: 'Instructor', sortable: true },
    { key: 'sectionLabel', header: 'Section' },
    { key: 'studentCount', header: 'Students', sortable: true },
    { key: 'joinCode', header: 'Join code', render: (c) => <code>{c.joinCode}</code> },
    { key: 'archived', header: 'Status', sortable: true, render: (c) => <Badge>{c.archived ? 'Archived' : 'Active'}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle="Every class created by an instructor. Classes are created in the mobile app, so this page is read and delete only."
        actions={
          <button
            type="button"
            className="btn btn-red"
            disabled={!selectedRows.length || busy}
            onClick={() => setDeleteIds(selectedRows.map((c) => c.id))}
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
            placeholder="Title, code or instructor"
            onChange={(e) => setQuery({ q: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Course</span>
          <select className="input" value={query.course} onChange={(e) => setQuery({ course: e.target.value })}>
            <option value="All">All courses</option>
            {COURSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select className="input" value={query.status} onChange={(e) => setQuery({ status: e.target.value })}>
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Archived">Archived</option>
          </select>
        </label>
      </div>

      <Card>
        {loading && <SkeletonTable rows={6} cols={6} />}

        {!loading && error && (
          <EmptyState
            tone="error"
            title="Classes could not load"
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
              rowLabel={(c) => c.title}
              caption="Classes"
              emptyTitle="No classes found"
              emptyMessage="Try a different filter or search term."
              renderActions={(c) => (
                <>
                  <Link to={path(ROUTES.classDetail, { id: c.id })} className="link-btn">
                    <Icon.Eye /> View
                  </Link>
                  <button type="button" className="link-btn warn" onClick={() => setDeleteIds([c.id])}>
                    <Icon.Trash /> Delete
                  </button>
                </>
              )}
            />
            {rows.length > 0 && <Pager pagination={pagination} onPageChange={(page) => setQuery({ page })} />}
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteIds}
        title={`Delete ${deleteIds?.length ?? 0} class${(deleteIds?.length ?? 0) === 1 ? '' : 'es'}?`}
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
          `${deleteIds?.length ?? 0} classes will be`
        )}{' '}
        permanently removed, together with their materials, assignments, quizzes and announcements. This cannot be
        undone.
      </ConfirmDialog>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
