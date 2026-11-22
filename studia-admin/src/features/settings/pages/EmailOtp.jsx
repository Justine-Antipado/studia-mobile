import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { isEmail } from '../../../core/logic/validation';
import Select from '../../../shared/components/Select';
import EmptyState from '../../../shared/components/EmptyState';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Card, Toast, Toggle } from '../../../shared/components/ui';
import { useToast } from '../../../shared/hooks';

const EXPIRY_OPTIONS = [3, 5, 10, 15];
const RESEND_OPTIONS = [30, 45, 60, 90];

// Rendered only once `settings` has loaded, so the form seeds its state
// straight from the initial value — no effect needed to sync it in after.
function EmailOtpForm({ initial, save, saving }) {
  const [form, setForm] = useState(initial);
  const [fieldError, setFieldError] = useState('');
  const { toast, showToast, showError, clearToast } = useToast();

  const onSave = async () => {
    if (!isEmail(form.senderEmail)) {
      setFieldError('Enter a valid sender email address.');
      return;
    }
    setFieldError('');
    try {
      await save({ email: form });
      showToast('Email & OTP settings saved.');
    } catch (e) {
      showError(e);
    }
  };

  return (
    <>
      <Card className="settings-card">
        <div className="form-grid">
          <label className="field field-wide">
            <span>Sender email</span>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={form.senderEmail}
              aria-invalid={!!fieldError || undefined}
              onChange={(e) => {
                setForm({ ...form, senderEmail: e.target.value });
                if (fieldError) setFieldError('');
              }}
            />
          </label>
          <div className="field">
            <span>OTP expiry</span>
            <Select
              label="OTP expiry"
              value={form.otpExpiryMinutes}
              options={EXPIRY_OPTIONS.map((m) => ({ value: m, label: m + ' minutes' }))}
              onChange={(otpExpiryMinutes) => setForm({ ...form, otpExpiryMinutes })}
            />
          </div>
          <div className="field">
            <span>Resend interval</span>
            <Select
              label="Resend interval"
              value={form.resendSeconds}
              options={RESEND_OPTIONS.map((s) => ({ value: s, label: s + ' seconds' }))}
              onChange={(resendSeconds) => setForm({ ...form, resendSeconds })}
            />
          </div>
        </div>
        {fieldError && <p className="field-error mt">{fieldError}</p>}
        <div className="switch-row mt">
          <div>
            <strong>Require OTP for password reset</strong>
            <small className="muted block">Sent to the registered school email.</small>
          </div>
          <Toggle checked={form.requireOtpForReset} onChange={(v) => setForm({ ...form, requireOtpForReset: v })} label="Require OTP for reset" />
        </div>
        <div className="form-footer">
          <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setForm(initial)}>
            Reset
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </Card>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}

export default function EmailOtp() {
  const { settings, error, loading, reload, save, saving } = useSettings();

  return (
    <>
      <PageHeader title="Email & OTP" subtitle="Sender address, expiry and resend interval." />

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

      {!loading && !error && settings && <EmailOtpForm initial={settings.email} save={save} saving={saving} />}
    </>
  );
}
