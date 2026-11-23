import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import {
  MAINTENANCE_FEATURES,
  MAINTENANCE_ROLES,
  MAINTENANCE_SCOPES,
  SUB_FEATURE_NOTE,
  UPDATE_SCOPES,
  describeMaintenance,
  describeUpdate,
  isMaintenanceValid,
  normalizeMaintenance,
  normalizeUpdate,
  updateErrors,
} from '../../../core/logic/maintenance';
import { setMaintenance } from '../../../core/state/maintenance';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import DateField from '../../../shared/components/DateField';
import EmptyState from '../../../shared/components/EmptyState';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Card, Toast, Toggle } from '../../../shared/components/ui';
import { useToast } from '../../../shared/hooks';

/** Add or remove one value from a list of selected ids. */
const toggleIn = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

export default function SystemSettings() {
  const { settings, error, loading, reload, save, saving } = useSettings();

  return (
    <>
      <PageHeader title="System" subtitle="Maintenance mode, version and updates." />

      {loading && <Skeleton height={320} radius="var(--radius-lg)" />}

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

      {!loading && !error && settings && <SystemForm system={settings.system} save={save} saving={saving} />}
    </>
  );
}

// Rendered only once `settings` has loaded, so the form seeds its state from
// the stored document — no effect needed to sync it in after.
function SystemForm({ system, save, saving }) {
  const [draft, setDraft] = useState(() => normalizeMaintenance(system.maintenance, system.maintenanceMode));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast, showToast, showError, clearToast } = useToast();

  const patch = (changes) => setDraft((d) => ({ ...d, ...changes }));
  const summary = describeMaintenance(draft);
  const valid = isMaintenanceValid(draft);

  const onSave = async () => {
    // The banner goes up optimistically and comes back down if the save fails.
    const previous = setMaintenance(draft);
    setConfirmOpen(false);
    try {
      await save({
        system: {
          ...system,
          maintenance: draft,
          // The old boolean stays in step, so anything still reading it is right.
          maintenanceMode: draft.enabled,
        },
      });
      showToast(draft.enabled ? 'Maintenance window saved.' : 'Maintenance mode is off.');
    } catch (e) {
      setMaintenance(previous);
      showError(e);
    }
  };

  return (
    <>
      <Card
        className="settings-panel"
        title="Maintenance"
        subtitle="Close part or all of the mobile app while you work."
      >
        <div className="switch-row">
          <div>
            <strong>Enable maintenance mode</strong>
            <small className="muted block">Admins keep full access, whatever the scope.</small>
          </div>
          <Toggle
            checked={draft.enabled}
            disabled={saving}
            onChange={(enabled) => patch({ enabled })}
            label="Enable maintenance mode"
          />
        </div>

        {/* The scope panel expands and collapses with the master switch. */}
        <div className={'reveal' + (draft.enabled ? ' open' : '')}>
          <div className="reveal-inner">
            <fieldset className="scope-set">
              <legend>Scope</legend>
              <div className="radio-cards">
                {MAINTENANCE_SCOPES.map((option) => (
                  <label key={option.value} className={'radio-card' + (draft.scope === option.value ? ' on' : '')}>
                    <input
                      type="radio"
                      name="maintenance-scope"
                      value={option.value}
                      checked={draft.scope === option.value}
                      onChange={() => patch({ scope: option.value })}
                    />
                    <span className="radio-dot" aria-hidden="true" />
                    <span className="radio-card-text">
                      <strong>{option.label}</strong>
                      <small>{option.hint}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {draft.scope === 'roles' && (
              <fieldset className="scope-set">
                <legend>Roles to block</legend>
                <div className="check-grid">
                  {MAINTENANCE_ROLES.map((role) => (
                    <label key={role.value} className="check-item">
                      <input
                        type="checkbox"
                        checked={draft.roles.includes(role.value)}
                        onChange={() => patch({ roles: toggleIn(draft.roles, role.value) })}
                      />
                      <span>{role.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {draft.scope === 'features' && (
              <fieldset className="scope-set">
                <legend>Features to close</legend>
                <p className="muted small">{SUB_FEATURE_NOTE}</p>
                <div className="check-grid">
                  {MAINTENANCE_FEATURES.map((feature) => (
                    <label key={feature.id} className="check-item">
                      <input
                        type="checkbox"
                        checked={draft.features.includes(feature.id)}
                        onChange={() => patch({ features: toggleIn(draft.features, feature.id) })}
                      />
                      <span>{feature.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <label className="field">
              <span>Message shown to affected users (optional)</span>
              <textarea
                className="input textarea"
                maxLength={240}
                placeholder="We're upgrading the quiz engine. Try again after 6 PM."
                value={draft.message}
                onChange={(e) => patch({ message: e.target.value })}
              />
            </label>

            <div className="form-grid">
              <div className="field">
                <span>Starts</span>
                <DateField
                  label="Maintenance starts"
                  withTime
                  placeholder="Right away"
                  value={draft.startsAt}
                  onChange={(startsAt) => patch({ startsAt })}
                />
              </div>
              <div className="field">
                <span>Ends</span>
                <DateField
                  label="Maintenance ends"
                  withTime
                  placeholder="Until turned off"
                  value={draft.endsAt}
                  onChange={(endsAt) => patch({ endsAt })}
                />
              </div>
            </div>
          </div>
        </div>

        <p className={'summary-line' + (valid ? '' : ' invalid')} role="status">
          {summary}
        </p>

        <div className="form-footer">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={() => setDraft(normalizeMaintenance(system.maintenance, system.maintenanceMode))}
          >
            Reset
          </button>
          <button type="button" className="btn btn-primary" disabled={saving || !valid} onClick={() => setConfirmOpen(true)}>
            {saving ? 'Saving…' : 'Save maintenance'}
          </button>
        </div>
      </Card>

      <UpdateCard system={system} save={save} saving={saving} />

      <ConfirmDialog
        open={confirmOpen}
        title={draft.enabled ? 'Turn maintenance on?' : 'Turn maintenance off?'}
        confirmLabel={draft.enabled ? 'Turn on' : 'Turn off'}
        tone={draft.enabled ? 'danger' : 'primary'}
        busy={saving}
        onConfirm={onSave}
        onClose={() => setConfirmOpen(false)}
      >
        {summary}
        {draft.enabled && (draft.endsAt ? ' It lifts itself at the end time you set.' : ' It stays on until you turn it off.')}
      </ConfirmDialog>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}

// "After the maintenance": make the new version mandatory. Installed apps older than the minimum
// version cannot use the whole app / the chosen features and are told to download the new version.
function UpdateCard({ system, save, saving }) {
  const [draft, setDraft] = useState(() => normalizeUpdate(system.update));
  const { toast, showToast, showError, clearToast } = useToast();
  const errors = updateErrors(draft);
  const valid = Object.keys(errors).length === 0;
  const patch = (changes) => setDraft((d) => ({ ...d, ...changes }));

  const onSave = async () => {
    try {
      await save({ system: { ...system, update: draft } });
      showToast(draft.required ? 'Required update saved.' : 'Update requirement is off.');
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Card
      className="settings-panel"
      title="Required app update"
      subtitle="Use this after maintenance when the changes only work in a new version of the app."
    >
      <div className="switch-row">
        <div>
          <strong>Require the new version</strong>
          <small className="muted block">Old installed versions cannot use what you choose below.</small>
        </div>
        <Toggle
          checked={draft.required}
          disabled={saving}
          onChange={(required) => patch({ required })}
          label="Require the new version"
        />
      </div>

      <div className={'reveal' + (draft.required ? ' open' : '')}>
        <div className="reveal-inner">
          <label className="field">
            <span>Minimum version (the new release)</span>
            <input
              className="input"
              inputMode="decimal"
              placeholder="1.2.0"
              maxLength={14}
              value={draft.minVersion}
              onChange={(e) => patch({ minVersion: e.target.value })}
              aria-invalid={!!errors.minVersion}
            />
            {errors.minVersion && <small className="field-error">{errors.minVersion}</small>}
            <small className="muted">Must match the version in the app&apos;s app.json for that release.</small>
          </label>

          <fieldset className="scope-set">
            <legend>What stops working on old versions</legend>
            <div className="radio-cards">
              {UPDATE_SCOPES.map((option) => (
                <label key={option.value} className={'radio-card' + (draft.scope === option.value ? ' on' : '')}>
                  <input
                    type="radio"
                    name="update-scope"
                    value={option.value}
                    checked={draft.scope === option.value}
                    onChange={() => patch({ scope: option.value })}
                  />
                  <span className="radio-dot" aria-hidden="true" />
                  <span className="radio-card-text">
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {draft.scope === 'features' && (
            <fieldset className="scope-set">
              <legend>Features that need the new version</legend>
              <p className="muted small">{SUB_FEATURE_NOTE}</p>
              <div className="check-grid">
                {MAINTENANCE_FEATURES.map((feature) => (
                  <label key={feature.id} className="check-item">
                    <input
                      type="checkbox"
                      checked={draft.features.includes(feature.id)}
                      onChange={() => patch({ features: toggleIn(draft.features, feature.id) })}
                    />
                    <span>{feature.label}</span>
                  </label>
                ))}
              </div>
              {errors.features && <small className="field-error">{errors.features}</small>}
            </fieldset>
          )}

          <label className="field">
            <span>Download link</span>
            <input
              className="input"
              type="url"
              placeholder="https://… (Play Store, App Store or your build link)"
              value={draft.downloadUrl}
              onChange={(e) => patch({ downloadUrl: e.target.value })}
              aria-invalid={!!errors.downloadUrl}
            />
            {errors.downloadUrl && <small className="field-error">{errors.downloadUrl}</small>}
          </label>

          <label className="field">
            <span>Message shown to users (optional)</span>
            <textarea
              className="input textarea"
              maxLength={240}
              placeholder="Quizzes were rebuilt. Please download the new version."
              value={draft.message}
              onChange={(e) => patch({ message: e.target.value })}
            />
          </label>
        </div>
      </div>

      <p className={'summary-line' + (valid ? '' : ' invalid')} role="status">
        {describeUpdate(draft)}
      </p>
      <div className="form-footer">
        <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setDraft(normalizeUpdate(system.update))}>
          Reset
        </button>
        <button type="button" className="btn btn-primary" disabled={saving || !valid} onClick={onSave}>
          {saving ? 'Saving…' : 'Save update requirement'}
        </button>
      </div>
      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </Card>
  );
}
