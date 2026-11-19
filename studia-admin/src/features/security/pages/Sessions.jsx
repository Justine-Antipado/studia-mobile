// Phase 7: active admin sessions, with revoke. There is one admin account,
// but it can be signed in from several devices at once.
import { useState } from 'react';
import * as securityRepo from '../data/securityRepository';
import { ROUTES } from '../../../core/config/routes';
import { formatRelative } from '../../../core/logic/format';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import DataTable from '../../../shared/components/DataTable';
import { Icon } from '../../../shared/components/Icon';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonTable } from '../../../shared/components/Skeleton';
import { Badge, Card, Toast } from '../../../shared/components/ui';
import EmptyState from '../../../shared/components/EmptyState';
import { useAsync, useToast } from '../../../shared/hooks';

export default function Sessions() {
  const { data, error, loading, reload, setData } = useAsync((signal) => securityRepo.getSessions({ signal }), []);
  const [revokeId, setRevokeId] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast, showToast, showError, clearToast } = useToast();

  const rows = data ?? [];
  const target = rows.find((s) => s.id === revokeId);

  const runRevoke = async () => {
    setBusy(true);
    try {
      await securityRepo.revokeSession(revokeId);
      setData((prev) => (prev ?? []).filter((s) => s.id !== revokeId));
      showToast('Session revoked.');
      setRevokeId(null);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: 'device',
      header: 'Device',
      primary: true,
      render: (s) => (
        <div>
          <strong>{s.device}</strong>
          <div className="muted small">{s.browser}</div>
        </div>
      ),
    },
    { key: 'location', header: 'Location', render: (s) => s.location },
    { key: 'ip', header: 'IP address', render: (s) => s.ip },
    { key: 'lastActiveAt', header: 'Last active', render: (s) => formatRelative(s.lastActiveAt) },
    { key: 'current', header: 'Status', render: (s) => (s.current ? <Badge tone="green">This device</Badge> : null) },
  ];

  return (
    <>
      <PageHeader title="Active sessions" subtitle="Admin sessions you can revoke." back={ROUTES.security} />

      <Card>
        {loading && <SkeletonTable rows={4} cols={5} />}

        {!loading && error && (
          <EmptyState
            tone="error"
            title="Sessions could not load"
            message={error.message}
            action={
              <button type="button" className="btn btn-primary" onClick={reload}>
                Try again
              </button>
            }
          />
        )}

        {!loading && !error && (
          <DataTable
            columns={columns}
            rows={rows}
            rowLabel={(s) => `${s.device} · ${s.browser}`}
            caption="Active sessions"
            emptyTitle="No active sessions"
            emptyMessage="Nothing is currently signed in."
            renderActions={(s) =>
              s.current ? (
                <span className="muted small">Current session</span>
              ) : (
                <button type="button" className="link-btn warn" onClick={() => setRevokeId(s.id)}>
                  <Icon.Trash /> Revoke
                </button>
              )
            }
          />
        )}
      </Card>

      <ConfirmDialog
        open={!!revokeId}
        title="Revoke this session?"
        confirmLabel="Revoke"
        busy={busy}
        onConfirm={runRevoke}
        onClose={() => setRevokeId(null)}
      >
        {target && (
          <>
            This signs out <b>{target.browser} · {target.device}</b> ({target.location}) immediately. The admin will
            need to sign in again on that device.
          </>
        )}
      </ConfirmDialog>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
