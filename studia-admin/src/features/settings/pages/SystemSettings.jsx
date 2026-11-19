import { useSettings } from '../hooks/useSettings';
import { ROUTES } from '../../../core/config/routes';
import EmptyState from '../../../shared/components/EmptyState';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Badge, Card, Toast, Toggle } from '../../../shared/components/ui';
import { useToast } from '../../../shared/hooks';

export default function SystemSettings() {
  const { settings, error, loading, reload, save, saving } = useSettings();
  const { toast, showToast, showError, clearToast } = useToast();

  const onMaintenanceToggle = async (maintenanceMode) => {
    try {
      await save({ system: { ...settings.system, maintenanceMode } });
      showToast(maintenanceMode ? 'Maintenance mode is ON.' : 'Maintenance mode is OFF.');
    } catch (e) {
      showError(e);
    }
  };

  return (
    <>
      <PageHeader title="System" subtitle="Maintenance mode, version and updates." back={ROUTES.settings} />

      {loading && <Skeleton height={220} radius="var(--radius-lg)" />}

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
        <Card>
          <div className="switch-row">
            <div>
              <strong>Maintenance mode</strong>
              <small className="muted block">Blocks student and instructor logins.</small>
            </div>
            <Toggle checked={settings.system.maintenanceMode} disabled={saving} onChange={onMaintenanceToggle} label="Maintenance mode" />
          </div>
          <div className="switch-row">
            <div>
              <strong>App version</strong>
              <small className="muted block">STUDIA Mobile {settings.system.appVersion}</small>
            </div>
            {settings.system.upToDate && <Badge>Up to date</Badge>}
          </div>
          <button type="button" className="btn btn-soft btn-block mt" onClick={() => showToast("You're on the latest version.")}>
            Check for updates
          </button>
        </Card>
      )}

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
