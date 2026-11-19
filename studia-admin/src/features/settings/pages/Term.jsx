import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { ROUTES } from '../../../core/config/routes';
import EmptyState from '../../../shared/components/EmptyState';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Card, Toast } from '../../../shared/components/ui';
import { useToast } from '../../../shared/hooks';

const SCHOOL_YEARS = ['2025–2026', '2026–2027', '2027–2028'];
const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];

// Rendered only once `settings` has loaded, so the form can seed its state
// straight from the initial value — no effect needed to sync it in after
// the fact (the same trick the pre-phase-7 Settings.jsx already used).
function TermForm({ initial, save, saving }) {
  const [form, setForm] = useState(initial);
  const [fieldError, setFieldError] = useState('');
  const { toast, showToast, showError, clearToast } = useToast();

  const onSave = async () => {
    if (form.startDate >= form.endDate) {
      setFieldError('End date must be after the start date.');
      return;
    }
    setFieldError('');
    try {
      await save({ term: form });
      showToast('Academic term saved.');
    } catch (e) {
      showError(e);
    }
  };

  return (
    <>
      <Card>
        <div className="two-col">
          <label className="field">
            <span>School year</span>
            <select className="input" value={form.schoolYear} onChange={(e) => setForm({ ...form, schoolYear: e.target.value })}>
              {SCHOOL_YEARS.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Semester</span>
            <select className="input" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
              {SEMESTERS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Start date</span>
            <input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </label>
          <label className="field">
            <span>End date</span>
            <input type="date" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </label>
        </div>
        {fieldError && <p className="field-error mt">{fieldError}</p>}
        <button type="button" className="btn btn-primary btn-block mt" disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save term'}
        </button>
      </Card>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}

export default function Term() {
  const { settings, error, loading, reload, save, saving } = useSettings();

  return (
    <>
      <PageHeader title="Academic term" subtitle="School year, semester and dates." back={ROUTES.settings} />

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

      {!loading && !error && settings && <TermForm initial={settings.term} save={save} saving={saving} />}
    </>
  );
}
