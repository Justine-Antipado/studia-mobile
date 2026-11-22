// mockBackend.login() reads maxLoginAttempts/lockoutMinutes from this section
// live, so saving here actually changes lockout behavior, not just a label.
import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import EmptyState from '../../../shared/components/EmptyState';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Card, Toast, Toggle } from '../../../shared/components/ui';
import { useToast } from '../../../shared/hooks';

// Rendered only once `settings` has loaded, so the form seeds its state
// straight from the initial value — no effect needed to sync it in after.
function SecurityPolicyForm({ initial, save, saving }) {
  const [form, setForm] = useState(initial);
  const { toast, showToast, showError, clearToast } = useToast();

  const onSave = async () => {
    try {
      await save({ securityPolicy: form });
      showToast('Security policy saved.');
    } catch (e) {
      showError(e);
    }
  };

  return (
    <>
      <Card className="settings-card">
        <h4 className="subhead" style={{ marginTop: 0 }}>Password rules</h4>
        <div className="two-col">
          <label className="field">
            <span>Minimum length</span>
            <input
              type="number"
              min={8}
              max={64}
              className="input"
              value={form.minPasswordLength}
              onChange={(e) => setForm({ ...form, minPasswordLength: Number(e.target.value) })}
            />
          </label>
        </div>
        <div className="switch-row">
          <strong>Require an uppercase letter</strong>
          <Toggle checked={form.requireUppercase} onChange={(v) => setForm({ ...form, requireUppercase: v })} label="Require uppercase" />
        </div>
        <div className="switch-row">
          <strong>Require a number</strong>
          <Toggle checked={form.requireNumber} onChange={(v) => setForm({ ...form, requireNumber: v })} label="Require a number" />
        </div>
        <div className="switch-row">
          <strong>Require a symbol</strong>
          <Toggle checked={form.requireSymbol} onChange={(v) => setForm({ ...form, requireSymbol: v })} label="Require a symbol" />
        </div>

        <h4 className="subhead">Session & lockout</h4>
        <div className="two-col">
          <label className="field">
            <span>Session timeout (minutes)</span>
            <input
              type="number"
              min={5}
              max={120}
              className="input"
              value={form.sessionTimeoutMinutes}
              onChange={(e) => setForm({ ...form, sessionTimeoutMinutes: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Max login attempts</span>
            <input
              type="number"
              min={3}
              max={10}
              className="input"
              value={form.maxLoginAttempts}
              onChange={(e) => setForm({ ...form, maxLoginAttempts: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Lockout duration (minutes)</span>
            <input
              type="number"
              min={1}
              max={60}
              className="input"
              value={form.lockoutMinutes}
              onChange={(e) => setForm({ ...form, lockoutMinutes: Number(e.target.value) })}
            />
          </label>
        </div>

        <div className="form-footer">
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setForm(initial)}>
            Reset
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save policy'}
          </button>
        </div>
      </Card>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}

export default function SecurityPolicy() {
  const { settings, error, loading, reload, save, saving } = useSettings();

  return (
    <>
      <PageHeader title="Security policy" subtitle="Password rules, session and lockout limits." />

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

      {!loading && !error && settings && <SecurityPolicyForm initial={settings.securityPolicy} save={save} saving={saving} />}
    </>
  );
}
