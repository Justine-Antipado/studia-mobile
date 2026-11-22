// Phase 6: the admin inbox — failed jobs, storage warnings and security
// alerts, each mark-read/unread. The unread count here is the same number
// shown as the sidebar badge and the topbar bell dot: both render from
// core/state/navCounts, which this page patches optimistically, so marking one
// row — or all of them — clears the badge instantly and rolls back if the
// request fails.
import { useCallback, useMemo, useState } from 'react';
import * as notificationsRepo from '../data/notificationsRepository';
import { patchNavCounts, restoreNavCounts, useNavCounts } from '../../../core/state/navCounts';
import { formatRelative, truncate } from '../../../core/logic/format';
import { ActionButton, ActionRow } from '../../../shared/components/ActionButton';
import DataTable from '../../../shared/components/DataTable';
import EmptyState from '../../../shared/components/EmptyState';
import { Icon } from '../../../shared/components/Icon';
import Pager from '../../../shared/components/Pager';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonTable } from '../../../shared/components/Skeleton';
import Tabs from '../../../shared/components/Tabs';
import { Badge, Card, Toast } from '../../../shared/components/ui';
import { useAsync, usePagination, useQueryState, useToast } from '../../../shared/hooks';

const PAGE_SIZE = 10;
const DEFAULTS = { tab: 'All', page: 1, sort: 'createdAt', order: 'desc' };
const RESET_PAGE_ON = ['tab'];
const TABS = [
  { key: 'All', label: 'All' },
  { key: 'Unread', label: 'Unread' },
];
const TYPE_META = {
  job: { label: 'Failed job', icon: 'Alert' },
  storage: { label: 'Storage warning', icon: 'Info' },
  security: { label: 'Security alert', icon: 'Shield' },
};

export default function Notifications() {
  const [query, setQuery] = useQueryState(DEFAULTS, { resetPageOn: RESET_PAGE_ON });
  const [busyId, setBusyId] = useState(null);
  const [markAllBusy, setMarkAllBusy] = useState(false);
  const navCounts = useNavCounts();
  const unread = navCounts.unreadNotifications ?? 0;
  const { toast, showToast, showError, clearToast } = useToast();

  const params = useMemo(
    () => ({
      page: query.page,
      pageSize: PAGE_SIZE,
      sort: query.sort,
      order: query.order,
      filters: { read: query.tab === 'Unread' ? 'false' : undefined },
    }),
    [query]
  );

  const { data, error, loading, reload, setData } = useAsync(
    (signal) => notificationsRepo.getNotifications(params, { signal }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(params)]
  );

  const rows = data?.data ?? [];
  const pagination = usePagination({ page: query.page, pageSize: PAGE_SIZE, total: data?.meta.total ?? 0 });

  const applyRead = useCallback(
    (predicate, read) =>
      setData((current) =>
        current
          ? { ...current, data: current.data.map((n) => (predicate(n) ? { ...n, read } : n)) }
          : current
      ),
    [setData]
  );

  const toggleRead = useCallback(
    async (notification) => {
      const read = !notification.read;
      setBusyId(notification.id);
      const snapshot = data;
      const countsBefore = patchNavCounts({
        unreadNotifications: Math.max(0, unread + (read ? -1 : 1)),
      });
      applyRead((n) => n.id === notification.id, read);
      try {
        await notificationsRepo.markNotificationRead(notification.id, read);
        // The Unread tab no longer holds this row, so that list has to come back.
        if (query.tab === 'Unread') reload();
      } catch (e) {
        setData(snapshot);
        restoreNavCounts(countsBefore);
        showError(e);
      } finally {
        setBusyId(null);
      }
    },
    [applyRead, data, query.tab, reload, setData, showError, unread]
  );

  const markAllRead = useCallback(async () => {
    setMarkAllBusy(true);
    const snapshot = data;
    const countsBefore = patchNavCounts({ unreadNotifications: 0 });
    applyRead(() => true, true);
    try {
      await notificationsRepo.markAllNotificationsRead();
      showToast('All notifications marked as read.');
      if (query.tab === 'Unread') reload();
    } catch (e) {
      setData(snapshot);
      restoreNavCounts(countsBefore);
      showError(e);
    } finally {
      setMarkAllBusy(false);
    }
  }, [applyRead, data, query.tab, reload, setData, showError, showToast]);

  const columns = [
    {
      key: 'title',
      header: 'Notification',
      sortable: true,
      primary: true,
      render: (n) => {
        const TypeIcon = Icon[TYPE_META[n.type]?.icon ?? 'Info'];
        return (
          <div className={'notif-row' + (n.read ? '' : ' unread')}>
            <span className="notif-icon">
              <TypeIcon />
            </span>
            <div>
              <strong>{n.title}</strong> {!n.read && <Badge tone="blue">Unread</Badge>}
              <div className="muted small">{truncate(n.message, 90)}</div>
            </div>
          </div>
        );
      },
    },
    { key: 'type', header: 'Category', render: (n) => <Badge tone="lav">{TYPE_META[n.type]?.label ?? n.type}</Badge> },
    { key: 'createdAt', header: 'When', sortable: true, render: (n) => formatRelative(n.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Failed jobs, storage warnings and security alerts for the admin to review."
        actions={
          <button
            type="button"
            className="btn btn-ghost"
            disabled={unread === 0 || markAllBusy}
            onClick={markAllRead}
          >
            <Icon.Check /> Mark all as read
          </button>
        }
      />

      <Tabs
        aria-label="Filter by read status"
        items={TABS}
        value={query.tab}
        onChange={(tab) => setQuery({ tab })}
        controls="notifications-results"
      />

      <Card id="notifications-results" role="tabpanel" aria-labelledby={`tab-${query.tab}`}>
        {loading && <SkeletonTable rows={6} cols={3} />}

        {!loading && error && (
          <EmptyState
            tone="error"
            title="Notifications could not load"
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
              rowLabel={(n) => n.title}
              rowClassName={(n) => (n.read ? 'notif-read' : 'notif-unread')}
              onRowClick={(n) => !n.read && busyId !== n.id && toggleRead(n)}
              caption="Notifications"
              emptyTitle={query.tab === 'Unread' ? 'No unread notifications' : 'No notifications yet'}
              emptyMessage="You're all caught up."
              renderActions={(n) => (
                <ActionRow>
                  <ActionButton
                    icon={n.read ? 'Bell' : 'Check'}
                    label={n.read ? 'Mark unread' : 'Mark read'}
                    tone={n.read ? 'neutral' : 'primary'}
                    disabled={busyId === n.id}
                    onClick={() => toggleRead(n)}
                  />
                </ActionRow>
              )}
            />
            {rows.length > 0 && <Pager pagination={pagination} onPageChange={(page) => setQuery({ page })} />}
          </>
        )}
      </Card>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
