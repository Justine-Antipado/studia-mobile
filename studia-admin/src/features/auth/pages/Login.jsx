// Phase 2: glassmorphism login — frosted card over the campus photo, animated
// entrance, caps-lock hint, attempt counter, lockout countdown, accessible
// errors. The demo box still comes from core/config/demo.js.
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getDemoCredentials } from '../../../core/config/demo';
import { env } from '../../../core/config/env';
import { ROUTES } from '../../../core/config/routes';
import { formatCountdown } from '../../../core/logic/format';
import { validateField } from '../../../core/logic/validation';
import { Icon } from '../../../shared/components/Icon';
import { useDocumentTitle } from '../../../shared/hooks';
import { useAuth } from '../hooks/useAuth';
import campus from '../../../assets/omsu-campus.jpg';
import mascot from '../../../assets/studia-mascot.png';
import studiaLogo from '../../../assets/studia-logo.png';
import omsuLogo from '../../../assets/omsu-logo.png';

const demo = getDemoCredentials();

export default function Login() {
  const { isAuthed, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [lockSeconds, setLockSeconds] = useState(0);

  useDocumentTitle(`Sign in · ${env.appName}`, 'Administrator sign-in for the STUDIA portal.');

  // Ticks the lockout countdown and clears it once the wait is over.
  useEffect(() => {
    if (!lockedUntil) return undefined;
    const tick = () => {
      const left = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (left <= 0) {
        setLockedUntil(null);
        setError('');
        return;
      }
      setLockSeconds(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  if (isAuthed) return <Navigate to={ROUTES.dashboard} replace />;

  const isLocked = lockedUntil != null;
  const checkCapsLock = (e) => {
    if (typeof e.getModifierState === 'function') setCapsOn(e.getModifierState('CapsLock'));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (isLocked || loading) return;
    setError('');
    setAttemptsLeft(null);

    // strict: false — on login we only check that the fields are filled in, so
    // the password rules are never revealed to someone probing the form.
    const fieldError =
      validateField('identifier', identifier, { strict: false }) ??
      validateField('password', password, { strict: false });
    if (fieldError) {
      setError(fieldError);
      return;
    }

    setLoading(true);
    try {
      await login(identifier, password);
      const to = location.state?.from?.pathname ?? ROUTES.dashboard;
      navigate(to === ROUTES.login ? ROUTES.dashboard : to, { replace: true });
    } catch (err) {
      if (err.status === 429) {
        const retryAfterSec = err.meta?.retryAfterSec ?? 60;
        setLockedUntil(Date.now() + retryAfterSec * 1000);
        setLockSeconds(retryAfterSec);
      } else {
        setError(err.message || 'Sign-in failed. Please try again.');
        setAttemptsLeft(err.meta?.attemptsLeft ?? null);
      }
    } finally {
      setLoading(false);
    }
  };

  const describedBy = [isLocked || error ? 'login-error' : null, capsOn ? 'caps-hint' : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="login-page" style={{ backgroundImage: `url(${campus})` }}>
      <div className="login-overlay" aria-hidden="true" />

      <div className="login-stage">
        <div className="login-brand">
          <img className="login-mascot" src={mascot} alt="" aria-hidden="true" />
          <div className="login-brand-logos">
            <img src={omsuLogo} alt="OMSU seal" />
            <img src={studiaLogo} alt="STUDIA" />
          </div>
          <h1>STUDIA Admin Portal</h1>
          <p>Occidental Mindoro State University — Mamburao Campus</p>
        </div>

        <form className="login-card" onSubmit={onSubmit} noValidate>
          <h2>Welcome back</h2>
          <p className="muted">Sign in with the administrator account.</p>

          <label className="field">
            <span>Email or username</span>
            <div className="input-icon">
              <Icon.User />
              <input
                autoFocus
                name="identifier"
                autoComplete="username"
                placeholder="admin@omsu.edu.ph"
                value={identifier}
                disabled={isLocked}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? 'login-error' : undefined}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
          </label>

          <label className="field">
            <span>Password</span>
            <div className="input-icon">
              <Icon.Lock />
              <input
                type={show ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                disabled={isLocked}
                aria-invalid={!!error || undefined}
                aria-describedby={describedBy}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={checkCapsLock}
                onKeyUp={checkCapsLock}
              />
              <button
                type="button"
                className="eye"
                disabled={isLocked}
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <Icon.EyeOff /> : <Icon.Eye />}
              </button>
            </div>
            {capsOn && (
              <span id="caps-hint" className="caps-hint" role="status">
                <Icon.Alert /> Caps Lock is on
              </span>
            )}
          </label>

          {attemptsLeft != null && !isLocked && (
            <p className="form-hint-warn">
              {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} left before a temporary lockout.
            </p>
          )}

          {(error || isLocked) && (
            <div className="form-error" role="alert" id="login-error">
              {isLocked ? 'Too many failed attempts. Please wait before trying again.' : error}
            </div>
          )}
          {isLocked && (
            <p className="lock-countdown" aria-hidden="true">
              Try again in <strong>{formatCountdown(lockSeconds)}</strong>
            </p>
          )}

          <button className="btn btn-primary btn-block" disabled={loading || isLocked}>
            {loading ? (
              <span className="btn-loading">
                <span className="btn-spinner">
                  <Icon.Refresh />
                </span>
                Signing in…
              </span>
            ) : isLocked ? (
              `Locked · ${formatCountdown(lockSeconds)}`
            ) : (
              'Log in'
            )}
          </button>

          <p className="login-note">
            Admin accounts can't be created here. Contact the system owner if you've lost access.
          </p>

          {/* Only rendered while VITE_USE_MOCK=true; the credentials live in
              core/config/demoCredentials.js and nowhere else. */}
          {demo && (
            <details className="demo-creds">
              <summary>{demo.label}</summary>
              <code>{demo.identifier}</code> or <code>{demo.altIdentifier}</code> /{' '}
              <code>{demo.password}</code>
            </details>
          )}
        </form>

        <p className="login-footer">OMSU STUDIA · Private administrator portal</p>
      </div>
    </div>
  );
}
