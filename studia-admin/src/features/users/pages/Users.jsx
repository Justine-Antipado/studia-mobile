// Phase 4: rebuilt on DataTable with URL-synced filters, server-shaped paging
// and sort, and a user detail page. Accounts are created in the mobile app, so this page is read,
// approve and deactivate (View, Export, Approve/Deactivate per row; bulk via selection). Permanent
// delete lives on the profile page, where the admin first sees what would be lost.
//
// Status is Active / Pending / Inactive. "Pending" is a new instructor account: migration 030 refuses
// to trust a client that says `role: instructor`, so the account exists but cannot sign in until it is
// approved here. Approving and reactivating are the same call — admin_set_user_active(ids, true) —
// only the wording differs, because what the admin is deciding is different.
import { useMemo, useState } from 'react';
import UserFilters from '../components/UserFilters';
import { useNavigate } from 'react-router-dom';
import * as usersRepo from '../data/usersRepository';
import { path, ROUTES } from '../../../core/config/routes';
import { formatDate, formatRelative } from '../../../core/logic/format';
import { composeSection } from '../../../core/logic/validation';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { ActionButton, ActionRow } from '../../../shared/components/ActionButton';
import DataTable from '../../../shared/components/DataTable';
import { Icon } from '../../../shared/components/Icon';
import Pager from '../../../shared/components/Pager';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonTable } from '../../../shared/components/Skeleton';
import Tabs from '../../../shared/components/Tabs';
import { Avatar, Badge, Card, Toast } from '../../../shared/components/ui';
import EmptyState from '../../../shared/components/EmptyState';
import { useAsync, usePagination, useQueryState, useToast } from '../../../shared/hooks';
import { downloadCsv } from '../../../shared/utils/csv';

const TABS = [
  { key: 'All', label: 'All' },
  { key: 'Student', label: 'Students' },
  { key: 'Instructor', label: 'Instructors' },
];
const PAGE_SIZE = 10;

const DEFAULTS = {
  tab: 'All',
  page: 1,
  sort: 'name',
  order: 'asc',
  q: '',
  course: 'All',
  year: 'All',
  section: 'All',
  department: 'All',
  status: 'All',
};
const RESET_PAGE_ON = ['tab', 'q', 'course', 'year', 'section', 'department', 'status'];

const CSV_HEADERS = ['Name', 'Email', 'Role', 'Course', 'Year', 'Section', 'Department', 'Status', 'Joined', 'Last active'];
const toCsvRow = (u) => [u.name, u.email, u.role, u.course ?? '', u.year ?? '', u.section ?? '', u.department ?? '', u.status, formatDate(u.joinedAt), formatDate(u.lastActiveAt)];
const exportCsv = (rows, filename = 'studia-users.csv') => downloadCsv(filename, CSV_HEADERS, rows.map(toCsvRow));

export default function Users() {
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
      filters: {
        role: query.tab === 'All' ? undefined : query.tab,
        course: query.course,
        year: query.year,
        section: query.section,
        department: query.department,
        status: query.status,
      },
    }),
    [query]
  );

  const { data, error, loading, reload } = useAsync(
    (signal) => usersRepo.getUsers(params, { signal }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(params)]
  );

  const rows = data?.data ?? [];
  const pagination = usePagination({ page: query.page, pageSize: PAGE_SIZE, total: data?.meta.total ?? 0 });
  const selectedRows = rows.filter((u) => selected.has(u.id));
  // Only active accounts can be deactivated; a pending one is approved and a deactivated one
  // reactivated instead (both are admin_set_user_active(ids, true)).
  const activeSelected = selectedRows.filter((u) => u.status === 'Active');
  const pendingSelected = selectedRows.filter((u) => u.status === 'Pending');
  const deleteTargets = rows.filter((u) => deleteIds?.includes(u.id));

  const runDelete = async () => {
    if (!deleteIds?.length) return;
    setBusy(true);
    try {
      await usersRepo.setUsersActive(deleteIds, false);
      showToast(`${deleteIds.length} user${deleteIds.length === 1 ? '' : 's'} deactivated.`);
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

  /** Approve (pending) or reactivate (deactivated): one call, two sentences. */
  const activate = async (users) => {
    if (!users.length) return;
    const approving = users.every((u) => u.status === 'Pending');
    const verb = approving ? 'approved' : 'reactivated';
    setBusy(true);
    try {
      await usersRepo.setUsersActive(users.map((u) => u.id), true);
      showToast(users.length === 1 ? `${users[0].name} ${verb}.` : `${users.length} accounts ${verb}.`);
      setSelected((prev) => {
        const next = new Set(prev);
        users.forEach((u) => next.delete(u.id));
        return next;
      });
      reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      primary: true,
      render: (u) => (
        <div className="name-cell">
          <Avatar name={u.name} />
          <div>
            <strong>{u.name}</strong>
            <div className="muted small">{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', sortable: true, render: (u) => <Badge>{u.role}</Badge> },
    {
      key: 'course',
      header: 'Course / Dept',
      render: (u) => (u.role === 'Instructor' ? `Dept. ${u.department}` : composeSection(u.course, u.year, u.section)),
    },
    { key: 'status', header: 'Status', sortable: true, render: (u) => <Badge>{u.status}</Badge> },
    { key: 'joinedAt', header: 'Joined', sortable: true, render: (u) => formatDate(u.joinedAt) },
    { key: 'lastActiveAt', header: 'Last active', sortable: true, render: (u) => formatRelative(u.lastActiveAt) },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Students and instructors registered in the mobile app. New instructor accounts wait here for your approval before they can sign in."
        actions={
          <>
            <button type="button" className="btn btn-ghost" disabled={!rows.length} onClick={() => exportCsv(rows)}>
              <Icon.Download /> Export CSV
            </button>
            {pendingSelected.length > 0 && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => activate(pendingSelected)}>
                <Icon.Check /> Approve ({pendingSelected.length})
              </button>
            )}
            <button
              type="button"
              className="btn btn-red"
              disabled={!activeSelected.length || busy}
              onClick={() => setDeleteIds(activeSelected.map((u) => u.id))}
            >
              <Icon.Close /> Deactivate ({activeSelected.length})
            </button>
          </>
        }
      />

      <Tabs
        aria-label="Filter by role"
        items={TABS}
        value={query.tab}
        onChange={(tab) => setQuery({ tab })}
        controls="users-results"
      />

      <UserFilters query={query} onChange={setQuery} />

      <Card id="users-results" role="tabpanel" aria-labelledby={`tab-${query.tab}`}>
        {loading && <SkeletonTable rows={6} cols={6} />}

        {!loading && error && (
          <EmptyState
            tone="error"
            title="Users could not load"
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
              rowLabel={(u) => u.name}
              onRowClick={(u) => navigate(path(ROUTES.userDetail, { id: u.id }))}
              caption="Users"
              emptyTitle="No users found"
              emptyMessage="Try a different filter or search term."
              renderActions={(u) => (
                <ActionRow>
                  <ActionButton icon="Eye" label="View" tone="primary" to={path(ROUTES.userDetail, { id: u.id })} />
                  <ActionButton
                    icon="Download"
                    label="Export"
                    onClick={() => exportCsv([u], `studia-user-${u.id}.csv`)}
                  />
                  {u.status === 'Active' ? (
                    <ActionButton icon="Close" label="Deactivate" tone="danger" onClick={() => setDeleteIds([u.id])} />
                  ) : (
                    <ActionButton
                      icon="Check"
                      label={u.status === 'Pending' ? 'Approve' : 'Reactivate'}
                      tone="primary"
                      onClick={() => activate([u])}
                    />
                  )}
                </ActionRow>
              )}
            />
            {rows.length > 0 && <Pager pagination={pagination} onPageChange={(page) => setQuery({ page })} />}
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteIds}
        title={
          deleteTargets.length === 1
            ? `Deactivate ${deleteTargets[0].name}?`
            : `Deactivate ${deleteIds?.length ?? 0} users?`
        }
        confirmLabel="Deactivate"
        busy={busy}
        onConfirm={runDelete}
        onClose={() => setDeleteIds(null)}
      >
        {deleteTargets.length === 1 ? (
          <>
            <b>{deleteTargets[0].name}</b>
          </>
        ) : (
          `${deleteIds?.length ?? 0} users`
        )}{' '}
         cannot sign in any more and are signed out of every device. Nothing is deleted: classes, submissions and
        grades stay as they are, and you can reactivate the account from its profile.
      </ConfirmDialog>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
