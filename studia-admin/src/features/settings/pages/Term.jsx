import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import DateField from '../../../shared/components/DateField';
import Select from '../../../shared/components/Select';
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
      <Card className="settings-card">
        <div className="two-col">
          <div className="field">
            <span>School year</span>
            <Select
              label="School year"
              value={form.schoolYear}
              options={SCHOOL_YEARS}
              onChange={(schoolYear) => setForm({ ...form, schoolYear })}
            />
          </div>
          <div className="field">
            <span>Semester</span>
            <Select
              label="Semester"
              value={form.semester}
              options={SEMESTERS}
              onChange={(semester) => setForm({ ...form, semester })}
            />
          </div>
          <div className="field">
            <span>Start date</span>
            <DateField
              label="Start date"
              value={form.startDate}
              onChange={(startDate) => setForm({ ...form, startDate })}
            />
          </div>
          <div className="field">
            <span>End date</span>
            <DateField
              label="End date"
              value={form.endDate}
              onChange={(endDate) => setForm({ ...form, endDate })}
            />
          </div>
        </div>
        {fieldError && <p className="field-error mt">{fieldError}</p>}
        <div className="form-footer">
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setForm(initial)}>
            Reset
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save term'}
          </button>
        </div>
      </Card>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}

export default function Term() {
  const { settings, error, loading, reload, save, saving } = useSettings();

  return (
    <>
      <PageHeader title="Academic term" subtitle="School year, semester and dates." />

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
