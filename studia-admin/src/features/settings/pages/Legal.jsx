// Plain <textarea>, never dangerouslySetInnerHTML — the terms/privacy text is
// shown inside the mobile app as plain text (master prompt, section 7).
import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import EmptyState from '../../../shared/components/EmptyState';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Card, Toast } from '../../../shared/components/ui';
import { useToast } from '../../../shared/hooks';

// Rendered only once `settings` has loaded, so the form seeds its state
// straight from the initial value — no effect needed to sync it in after.
function LegalForm({ initial, save, saving }) {
  const [form, setForm] = useState(initial);
  const { toast, showToast, showError, clearToast } = useToast();

  const publish = async () => {
    try {
      await save({ legal: form });
      showToast('Policy published.');
    } catch (e) {
      showError(e);
    }
  };

  return (
    <>
      <div className="stack">
        <Card className="settings-card" title="Terms of use">
          <textarea className="input textarea" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
        </Card>
        <Card className="settings-card" title="Privacy policy">
          <textarea className="input textarea" value={form.privacy} onChange={(e) => setForm({ ...form, privacy: e.target.value })} />
        </Card>
        <div className="form-footer">
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setForm(initial)}>
            Reset
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={publish}>
            {saving ? 'Publishing…' : 'Publish policy'}
          </button>
        </div>
      </div>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}

export default function Legal() {
  const { settings, error, loading, reload, save, saving } = useSettings();

  return (
    <>
      <PageHeader title="Terms & privacy" subtitle="The text shown inside the mobile app." />

      {loading && <Skeleton height={340} radius="var(--radius-lg)" />}

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

      {!loading && !error && settings && <LegalForm initial={settings.legal} save={save} saving={saving} />}
    </>
  );
}
