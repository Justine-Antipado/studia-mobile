import { useState } from 'react';
import * as settingsRepo from '../data/settingsRepository';
import { useSettings } from '../hooks/useSettings';
import { formatDateTime } from '../../../core/logic/format';
import EmptyState from '../../../shared/components/EmptyState';
import { Icon } from '../../../shared/components/Icon';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Card, Toast } from '../../../shared/components/ui';
import { useToast } from '../../../shared/hooks';

export default function Backup() {
  const { settings, error, loading, reload, setSettings } = useSettings();
  const [backing, setBacking] = useState(false);
  const { toast, showToast, showError, clearToast } = useToast();

  const runBackup = async () => {
    setBacking(true);
    try {
      const backup = await settingsRepo.runBackup();
      setSettings((s) => ({ ...s, backup }));
      showToast('Backup completed.');
    } catch (e) {
      showError(e);
    } finally {
      setBacking(false);
    }
  };

  return (
    <>
      <PageHeader title="Backup" subtitle="Last backup, restore points and manual runs." />

      {loading && <Skeleton height={260} radius="var(--radius-lg)" />}

      {!loading && error && (
        <EmptyState
          tone="error"
          title="Settings could not load"
          message={error.message}
          action={
            <button type="button" className="btn btn-primary" onClick={reload}>
              Try again
            </button>
          }
        />
      )}

      {!loading && !error && settings && (
        <Card className="settings-card">
          <div className="backup-row">
            <span className="check-tile">
              <Icon.Check />
            </span>
            <div>
              <strong>Last backup successful</strong>
              <small className="muted block">
                {formatDateTime(settings.backup.lastBackupAt)} · {settings.backup.lastBackupSizeLabel}
              </small>
            </div>
          </div>
          <div className="form-footer">
            <button type="button" className="btn btn-soft" onClick={runBackup} disabled={backing}>
              {backing ? 'Backing up…' : 'Back up now'}
            </button>
          </div>

          <h4 className="subhead">Restore points</h4>
          <ul className="dt-cards">
            {settings.backup.restorePoints.map((p) => (
              <li className="dt-card" key={p.id}>
                <div className="dt-card-head">
                  <div className="dt-card-title">{formatDateTime(p.at)}</div>
                </div>
                <dl className="dt-card-body">
                  <div className="dt-card-row">
                    <dt>Size</dt>
                    <dd>{p.sizeLabel}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
