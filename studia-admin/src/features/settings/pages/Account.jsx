// Phase 7: profile + password change with the OTP flow (send, verify,
// update). Fixes the phase-0 audit's 7.3 finding — the old strength() meter
// enabled "Update password" at a score of 2/4; this uses the same five
// all-required PASSWORD_RULES studia-mobile enforces, shown as a checklist;
// studia-api re-checks the rule and the emailed code server-side.
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import * as settingsRepo from '../data/settingsRepository';
import { useAuth } from '../../auth/hooks/useAuth';
import { PASSWORD_RULES } from '../../../core/logic/validation';
import EmptyState from '../../../shared/components/EmptyState';
import { Icon } from '../../../shared/components/Icon';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton } from '../../../shared/components/Skeleton';
import { Avatar, Card, Toast } from '../../../shared/components/ui';
import { useToast } from '../../../shared/hooks';

function RuleChecklist({ password }) {
  return (
    <ul className="rule-list">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className={`rule-item ${met ? 'met' : ''}`}>
            <span className="rule-icon">{met ? <Icon.Check /> : <Icon.Close />}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

const RESEND_SECONDS = 60;

export default function Account() {
  const { admin } = useAuth();
  const { settings, error, loading, reload } = useSettings();
  const [otpSent, setOtpSent] = useState(false);
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, showToast, showError, clearToast } = useToast();
  const refs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const code = digits.join('');
  const allRulesMet = PASSWORD_RULES.every((r) => r.test(pw));
  const mismatch = pw2 && pw !== pw2;

  const sendOtp = async () => {
    setBusy(true);
    try {
      const r = await settingsRepo.sendOtp();
      setOtpSent(true);
      setVerified(false);
      setDigits(Array(6).fill(''));
      setCooldown(RESEND_SECONDS);
      showToast(`A 6-digit code was sent to ${r.sentTo}.`);
      setTimeout(() => refs.current[0]?.focus(), 50);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value) => {
    try {
      await settingsRepo.verifyOtp(value);
      setVerified(true);
      showToast('OTP verified. You can set a new password.');
    } catch (e) {
      showError(e);
    }
  };

  const onDigit = (i, value) => {
    const d = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) verify(next.join(''));
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const updatePassword = async () => {
    if (pw !== pw2) {
      showError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await settingsRepo.updatePassword(code, pw);
      showToast('Password updated.');
      setOtpSent(false);
      setVerified(false);
      setDigits(Array(6).fill(''));
      setPw('');
      setPw2('');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Admin account" subtitle="Profile and password change with OTP." />

      {loading && <Skeleton height={420} radius="var(--radius-lg)" />}

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
          <div className="profile-row">
            <Avatar name={admin?.name ?? 'Admin'} size={52} />
            <div>
              <strong>{admin?.name}</strong>
              <small className="muted block">{admin?.email}</small>
            </div>
          </div>

          <p className="step">Step 1 · Send OTP to {admin?.email}</p>
          <div className="form-footer">
            <button type="button" className="btn btn-soft" onClick={sendOtp} disabled={busy || cooldown > 0}>
              {cooldown > 0 ? `Resend OTP (0:${String(cooldown).padStart(2, '0')})` : otpSent ? 'Resend OTP' : 'Send OTP'}
            </button>
          </div>

          <p className="step">
            Step 2 · Enter OTP{cooldown > 0 && ` (resend in 0:${String(cooldown).padStart(2, '0')})`}
          </p>
          <div className="otp-row">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={`otp-box ${verified ? 'ok' : ''}`}
                inputMode="numeric"
                maxLength={1}
                value={d}
                disabled={!otpSent || verified}
                onChange={(e) => onDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                aria-label={`OTP digit ${i + 1}`}
              />
            ))}
          </div>

          <p className="step">Step 3 · New password (unlocks after a valid OTP)</p>
          <div className="two-col">
            <label className="field">
              <span>New password</span>
              <input
                type="password"
                className="input"
                disabled={!verified}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••"
              />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                type="password"
                className="input"
                disabled={!verified}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder="••••••••"
              />
            </label>
          </div>
          <RuleChecklist password={pw} />
          {mismatch && <p className="field-error mt">Passwords don't match.</p>}
          <div className="form-footer">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!verified || !allRulesMet || !pw2 || mismatch || busy}
              onClick={updatePassword}
            >
              Update password
            </button>
          </div>
        </Card>
      )}

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
