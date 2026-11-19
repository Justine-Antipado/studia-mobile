import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { ROUTES } from '../../../core/config/routes';
import EmptyState from '../../../shared/components/EmptyState';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Card, Toast } from '../../../shared/components/ui';
import { useToast } from '../../../shared/hooks';

const TYPE_OPTIONS = [
  { value: 'mp4', label: '.mp4 video' },
  { value: 'mov', label: '.mov video' },
  { value: 'pdf', label: '.pdf' },
  { value: 'pptx', label: 'Slides (.pptx)' },
  { value: 'docx', label: 'Documents (.docx)' },
];

// Rendered only once `settings` has loaded, so the form seeds its state
// straight from the initial value — no effect needed to sync it in after.
function UploadsForm({ initial, save, saving }) {
  const [form, setForm] = useState(initial);
  const { toast, showToast, showError, clearToast } = useToast();

  const toggleType = (value) => {
    const next = form.allowedTypes.includes(value)
      ? form.allowedTypes.filter((t) => t !== value)
      : [...form.allowedTypes, value];
    setForm({ ...form, allowedTypes: next });
  };

  const onSave = async () => {
    try {
      await save({ uploads: form });
      showToast('Upload settings saved.');
    } catch (e) {
      showError(e);
    }
  };

  return (
    <>
      <Card>
        <h4 className="subhead" style={{ marginTop: 0 }}>Allowed file types</h4>
        <div className="chips" role="group" aria-label="Allowed file types">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`chip ${form.allowedTypes.includes(t.value) ? 'active' : ''}`}
              aria-pressed={form.allowedTypes.includes(t.value)}
              onClick={() => toggleType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <h4 className="subhead">Limits</h4>
        <div className="two-col">
          <label className="field">
            <span>Max video size (MB)</span>
            <input
              type="number"
              min={1}
              className="input"
              value={form.maxVideoSizeMb}
              onChange={(e) => setForm({ ...form, maxVideoSizeMb: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Max document size (MB)</span>
            <input
              type="number"
              min={1}
              className="input"
              value={form.maxDocumentSizeMb}
              onChange={(e) => setForm({ ...form, maxDocumentSizeMb: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Storage quota (GB)</span>
            <input
              type="number"
              min={1}
              className="input"
              value={form.storageQuotaGb}
              onChange={(e) => setForm({ ...form, storageQuotaGb: Number(e.target.value) })}
            />
          </label>
        </div>

        <button type="button" className="btn btn-primary btn-block mt" disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save uploads'}
        </button>
      </Card>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}

export default function Uploads() {
  const { settings, error, loading, reload, save, saving } = useSettings();

  return (
    <>
      <PageHeader title="Uploads" subtitle="Allowed file types, size limits and quota." back={ROUTES.settings} />

      {loading && <Skeleton height={300} radius="var(--radius-lg)" />}

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

      {!loading && !error && settings && <UploadsForm initial={settings.uploads} save={save} saving={saving} />}
    </>
  );
}
