import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Avatar, Badge, Card, Icon, Toast, Toggle } from '../components/ui';

/* ---------- helpers ---------- */
function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0-4
}
const STRENGTH_LABEL = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

/* ---------- Profile & Password (OTP flow) ---------- */
function ProfileCard({ settings, notify }) {
  const { admin } = useAuth();
  const [otpSent, setOtpSent] = useState(false);
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const refs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const code = digits.join('');

  const sendOtp = async () => {
    setBusy(true);
    try {
      const r = await api.sendOtp();
      setOtpSent(true);
      setVerified(false);
      setDigits(Array(6).fill(''));
      setCooldown(settings.email.resendSeconds);
      notify(`OTP sent to ${r.sentTo} (dev: ${r.devCode})`);
      setTimeout(() => refs.current[0]?.focus(), 50);
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value) => {
    try {
      await api.verifyOtp(value);
      setVerified(true);
      notify('OTP verified. You can set a new password.');
    } catch (e) {
      notify(e.message, 'err');
    }
  };

  const onDigit = (i, v) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) verify(next.join(''));
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const s = strength(pw);
  const mismatch = pw2 && pw !== pw2;

  const update = async () => {
    if (pw !== pw2) return notify('Passwords do not match.', 'err');
    setBusy(true);
    try {
      await api.updatePassword(code, pw);
      notify('Password updated.');
      setOtpSent(false); setVerified(false); setDigits(Array(6).fill('')); setPw(''); setPw2('');
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Profile & Password">
      <div className="profile-row">
        <Avatar name="AD" size={52} />
        <div>
          <strong>{admin?.name}</strong>
          <small className="muted block">{admin?.email}</small>
        </div>
      </div>

      <p className="step">Step 1 · Send OTP to {admin?.email}</p>
      <button className="btn btn-soft btn-block" onClick={sendOtp} disabled={busy || cooldown > 0}>
        {cooldown > 0 ? `Resend OTP (0:${String(cooldown).padStart(2, '0')})` : otpSent ? 'Resend OTP' : 'Send OTP'}
      </button>

      <p className="step">Step 2 · Enter OTP{cooldown > 0 && ` (resend in 0:${String(cooldown).padStart(2, '0')})`}</p>
      <div className="otp-row">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
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

      <p className="step">Step 3 · New password (unlocks after valid OTP)</p>
      <div className="two-col">
        <label className="field"><span>New password</span>
          <input type="password" className="input" disabled={!verified} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
        </label>
        <label className="field"><span>Confirm password</span>
          <input type="password" className="input" disabled={!verified} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" />
        </label>
      </div>
      <div className="meter"><div style={{ width: `${(s / 4) * 100}%`, background: s >= 3 ? 'var(--green)' : s === 2 ? 'var(--orange)' : 'var(--red)' }} /></div>
      <small className="muted">
        {pw ? STRENGTH_LABEL[s] : 'Strength'} · 8+ characters, number, symbol
        {mismatch && <b className="err"> · Passwords don’t match</b>}
      </small>
      <button className="btn btn-primary btn-block mt" disabled={!verified || s < 2 || !pw2 || busy} onClick={update}>
        Update password
      </button>
    </Card>
  );
}

/* ---------- Academic term + Email/OTP ---------- */
function TermAndEmailCard({ settings, onSave, notify }) {
  const [term, setTerm] = useState(settings.term);
  const [email, setEmail] = useState(settings.email);

  const saveTerm = async () => {
    if (term.startDate >= term.endDate) return notify('End date must be after start date.', 'err');
    await onSave({ term });
    notify('Academic term saved.');
  };

  const saveEmail = async (patch) => {
    const next = { ...email, ...patch };
    setEmail(next);
    await onSave({ email: next });
  };

  return (
    <div className="stack">
      <Card title="Academic Term">
        <div className="two-col">
          <label className="field"><span>School year</span>
            <select className="input" value={term.schoolYear} onChange={(e) => setTerm({ ...term, schoolYear: e.target.value })}>
              {['2025–2026', '2026–2027', '2027–2028'].map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
          <label className="field"><span>Semester</span>
            <select className="input" value={term.semester} onChange={(e) => setTerm({ ...term, semester: e.target.value })}>
              {['1st Semester', '2nd Semester', 'Summer'].map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
          <label className="field"><span>Start date</span>
            <input type="date" className="input" value={term.startDate} onChange={(e) => setTerm({ ...term, startDate: e.target.value })} />
          </label>
          <label className="field"><span>End date</span>
            <input type="date" className="input" value={term.endDate} onChange={(e) => setTerm({ ...term, endDate: e.target.value })} />
          </label>
        </div>
        <button className="btn btn-primary btn-block mt" onClick={saveTerm}>Save term</button>
      </Card>

      <Card title="Email & OTP">
        <div className="two-col">
          <label className="field"><span>Sender email</span>
            <input className="input" value={email.senderEmail} onChange={(e) => setEmail({ ...email, senderEmail: e.target.value })} onBlur={() => saveEmail({})} />
          </label>
          <label className="field"><span>OTP expiry</span>
            <select className="input" value={email.otpExpiryMinutes} onChange={(e) => saveEmail({ otpExpiryMinutes: Number(e.target.value) })}>
              {[3, 5, 10, 15].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </label>
        </div>
        <div className="switch-row">
          <div><strong>Require OTP for password reset</strong><small className="muted block">Sent to registered school email</small></div>
          <Toggle checked={email.requireOtpForReset} onChange={(v) => saveEmail({ requireOtpForReset: v })} label="Require OTP" />
        </div>
        <div className="switch-row">
          <div><strong>Resend timer</strong><small className="muted block">{email.resendSeconds} seconds before resend</small></div>
          <Toggle checked={email.resendSeconds > 0} onChange={(v) => saveEmail({ resendSeconds: v ? 60 : 0 })} label="Resend timer" />
        </div>
      </Card>
    </div>
  );
}

/* ---------- System ---------- */
function SystemCard({ settings, onSave, notify, reload }) {
  const [terms, setTerms] = useState(settings.terms);
  const [backing, setBacking] = useState(false);

  const backup = async () => {
    setBacking(true);
    await api.runBackup();
    await reload();
    setBacking(false);
    notify('Backup completed.');
  };

  return (
    <Card title="System">
      <div className="switch-row">
        <div><strong>Maintenance mode</strong><small className="muted block">Blocks student and instructor logins</small></div>
        <Toggle
          checked={settings.system.maintenanceMode}
          label="Maintenance mode"
          onChange={async (v) => {
            await onSave({ system: { ...settings.system, maintenanceMode: v } });
            notify(v ? 'Maintenance mode ON' : 'Maintenance mode OFF');
          }}
        />
      </div>
      <div className="switch-row">
        <div><strong>App version</strong><small className="muted block">STUDIA Mobile {settings.system.appVersion}</small></div>
        {settings.system.upToDate && <Badge>Up to date</Badge>}
      </div>

      <h4 className="subhead">Backup status</h4>
      <div className="backup-row">
        <span className="check-tile"><Icon.Check /></span>
        <div><strong>Last backup successful</strong><small className="muted block">{settings.backup.lastBackup}</small></div>
      </div>
      <button className="btn btn-soft btn-block" onClick={backup} disabled={backing}>{backing ? 'Backing up…' : 'Back up now'}</button>

      <h4 className="subhead">Terms & Privacy</h4>
      <textarea className="input textarea" value={terms} onChange={(e) => setTerms(e.target.value)} />
      <button
        className="btn btn-primary btn-block mt"
        onClick={async () => { await onSave({ terms }); notify('Policy published.'); }}
      >
        Publish policy
      </button>
    </Card>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [toast, setToast] = useState({ msg: '', kind: 'ok' });
  const notify = useCallback((msg, kind = 'ok') => setToast({ msg, kind }), []);
  const clearToast = useCallback(() => setToast({ msg: '', kind: 'ok' }), []);

  const reload = useCallback(() => api.getSettings().then(setSettings), []);
  useEffect(() => { reload(); }, [reload]);

  const onSave = async (patch) => setSettings(await api.saveSettings(patch));

  if (!settings) return <div className="loading">Loading settings…</div>;

  return (
    <>
      <h1 className="page-title">Settings</h1>
      <div className="settings-grid">
        <ProfileCard settings={settings} notify={notify} />
        <TermAndEmailCard settings={settings} onSave={onSave} notify={notify} />
        <SystemCard settings={settings} onSave={onSave} notify={notify} reload={reload} />
      </div>
      <Toast message={toast.msg} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
