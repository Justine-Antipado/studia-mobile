import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { ROUTES } from '../../../core/config/routes';
import { isEmail } from '../../../core/logic/validation';
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
      <Card>
        <div className="two-col">
          <label className="field">
            <span>Sender email</span>
            <input className="input" value={form.senderEmail} onChange={(e) => setForm({ ...form, senderEmail: e.target.value })} />
          </label>
          <label className="field">
            <span>OTP expiry</span>
            <select
              className="input"
              value={form.otpExpiryMinutes}
              onChange={(e) => setForm({ ...form, otpExpiryMinutes: Number(e.target.value) })}
            >
              {EXPIRY_OPTIONS.map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Resend interval</span>
            <select
              className="input"
              value={form.resendSeconds}
              onChange={(e) => setForm({ ...form, resendSeconds: Number(e.target.value) })}
            >
              {RESEND_OPTIONS.map((s) => (
                <option key={s} value={s}>{s} seconds</option>
              ))}
            </select>
          </label>
        </div>
        {fieldError && <p className="field-error mt">{fieldError}</p>}
        <div className="switch-row mt">
          <div>
            <strong>Require OTP for password reset</strong>
            <small className="muted block">Sent to the registered school email.</small>
          </div>
          <Toggle checked={form.requireOtpForReset} onChange={(v) => setForm({ ...form, requireOtpForReset: v })} label="Require OTP for reset" />
        </div>
        <button type="button" className="btn btn-primary btn-block mt" disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </Card>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}

export default function EmailOtp() {
  const { settings, error, loading, reload, save, saving } = useSettings();

  return (
    <>
      <PageHeader title="Email & OTP" subtitle="Sender address, expiry and resend interval." back={ROUTES.settings} />

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
