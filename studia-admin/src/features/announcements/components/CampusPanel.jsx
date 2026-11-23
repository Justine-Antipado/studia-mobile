// Campus-wide announcements the admin has sent. Sent notices cannot be edited; deleting a row here
// removes the record, not the Alerts that users already received.
import { useMemo, useState } from 'react';
import * as announcementsRepo from '../data/announcementsRepository';
import CampusComposeModal from './CampusComposeModal';
import { AUDIENCE_LABELS } from '../logic/constants';
import { formatDateTime } from '../../../core/logic/format';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { ActionButton, ActionRow } from '../../../shared/components/ActionButton';
import DataTable from '../../../shared/components/DataTable';
import EmptyState from '../../../shared/components/EmptyState';
import { Icon } from '../../../shared/components/Icon';
import Pager from '../../../shared/components/Pager';
import { SkeletonTable } from '../../../shared/components/Skeleton';
import { Badge, Card, Toast } from '../../../shared/components/ui';
import { useAsync, usePagination, useQueryState, useToast } from '../../../shared/hooks';

const PAGE_SIZE = 10;
const DEFAULTS = { page: 1, sort: 'createdAt', order: 'desc', q: '' };

export default function CampusPanel() {
  const [query, setQuery] = useQueryState(DEFAULTS, { resetPageOn: ['q'] });
  const [selected, setSelected] = useState(new Set());
  const [deleteIds, setDeleteIds] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const { toast, showToast, showError, clearToast } = useToast();

  const params = useMemo(
    () => ({ page: query.page, pageSize: PAGE_SIZE, sort: query.sort, order: query.order, q: query.q }),
    [query]
  );
  const { data, error, loading, reload } = useAsync(
    () => announcementsRepo.getCampusAnnouncements(params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(params)]
  );

  // Can a notice reach phones right now? (registered devices + the push function wired up)
  const { data: push } = useAsync(() => announcementsRepo.getPushStatus().catch(() => null), []);

  const rows = data?.data ?? [];
  const pagination = usePagination({ page: query.page, pageSize: PAGE_SIZE, total: data?.meta.total ?? 0 });
  const selectedRows = rows.filter((a) => selected.has(a.id));

  const runDelete = async () => {
    if (!deleteIds?.length) return;
    setDeleteBusy(true);
    try {
      await announcementsRepo.deleteCampusAnnouncements(deleteIds);
      showToast(`${deleteIds.length} record${deleteIds.length === 1 ? '' : 's'} deleted.`);
      setSelected(new Set());
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
      header: 'Sent to',
      render: (a) => <Badge tone="lav">{AUDIENCE_LABELS[a.audience]}{a.audience === 'course' ? ` · ${a.course}` : ''}</Badge>,
    },
    { key: 'recipients', header: 'Recipients', render: (a) => a.recipients },
    { key: 'createdAt', header: 'Sent', sortable: true, render: (a) => formatDateTime(a.createdAt) },
  ];

  return (
    <>
      {push && (
        <p className="small muted" role="status">
          {push.configured
            ? `Push is on: ${push.devices} phone${push.devices === 1 ? '' : 's'} registered across ${push.users} user${push.users === 1 ? '' : 's'}. Everyone still gets the notice in their Alerts tab.`
            : 'Push delivery is not set up yet, so announcements only appear in the Alerts tab.'}
        </p>
      )}
      <div className="filters">
        <label className="field search">
          <span>Search</span>
          <input className="input" value={query.q} placeholder="Title or message" onChange={(e) => setQuery({ q: e.target.value })} />
        </label>
        <div className="field">
          <button
            type="button"
            className="btn btn-red"
            disabled={!selectedRows.length || deleteBusy}
            onClick={() => setDeleteIds(selectedRows.map((a) => a.id))}
          >
            <Icon.Trash /> Delete ({selectedRows.length})
          </button>
        </div>
        <div className="field">
          <button type="button" className="btn btn-primary" onClick={() => setComposeOpen(true)}>
            <Icon.Megaphone /> New campus announcement
          </button>
        </div>
      </div>

      <Card>
        {loading && <SkeletonTable rows={6} cols={4} />}
        {!loading && error && (
          <EmptyState
            tone="error"
            title="Campus announcements could not load"
            message={error.message}
            action={<button type="button" className="btn btn-primary" onClick={reload}>Try again</button>}
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
              caption="Campus announcements"
              emptyTitle="Nothing sent yet"
              emptyMessage="Send a notice to every student and instructor. It shows up in their Alerts tab."
              emptyAction={
                <button type="button" className="btn btn-primary" onClick={() => setComposeOpen(true)}>
                  <Icon.Megaphone /> New campus announcement
                </button>
              }
              renderActions={(a) => (
                <ActionRow>
                  <ActionButton icon="Trash" label="Delete record" tone="danger" onClick={() => setDeleteIds([a.id])} />
                </ActionRow>
              )}
            />
            {rows.length > 0 && <Pager pagination={pagination} onPageChange={(page) => setQuery({ page })} />}
          </>
        )}
      </Card>

      {composeOpen && (
        <CampusComposeModal
          onClose={() => setComposeOpen(false)}
          onSent={(sent) => {
            setComposeOpen(false);
            showToast(`Sent to ${sent.recipients} ${sent.recipients === 1 ? 'person' : 'people'}.`);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteIds}
        title={`Delete ${deleteIds?.length ?? 0} record${(deleteIds?.length ?? 0) === 1 ? '' : 's'}?`}
        confirmWord="DELETE"
        confirmLabel="Delete record"
        busy={deleteBusy}
        onConfirm={runDelete}
        onClose={() => setDeleteIds(null)}
      >
        The record is removed from this list. Alerts that people already received stay in their app.
      </ConfirmDialog>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
