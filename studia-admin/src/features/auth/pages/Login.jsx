import { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../../../shared/components/ui';
import campus from '../../../assets/omsu-campus.jpg';
import mascot from '../../../assets/studia-mascot.png';
import studiaLogo from '../../../assets/studia-logo.png';
import omsuLogo from '../../../assets/omsu-logo.png';

export default function Login() {
  const { isAuthed, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthed) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Please enter your email/username and password.');
      return;
    }
    setLoading(true);
    try {
      await login(identifier, password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-hero" style={{ backgroundImage: `url(${campus})` }}>
        <div className="login-hero-overlay" />
        <div className="login-hero-content">
          <img className="login-mascot" src={mascot} alt="STUDIA mascot" />
          <div className="login-hero-logos">
            <img src={omsuLogo} alt="OMSU seal" />
            <img src={studiaLogo} alt="STUDIA Mobile" />
          </div>
          <h1>STUDIA Admin Portal</h1>
          <p>Occidental Mindoro State University — manage users, academic terms and system settings in one place.</p>
        </div>
      </div>

      <div className="login-panel">
        <form className="login-card" onSubmit={onSubmit} noValidate>
          <img className="login-card-logo" src={studiaLogo} alt="STUDIA" />
          <h2>Welcome back</h2>
          <p className="muted">Sign in with the administrator account.</p>

          <label className="field">
            <span>Email or username</span>
            <div className="input-icon">
              <Icon.User />
              <input
                autoFocus
                autoComplete="username"
                placeholder="admin@omsu.edu.ph"
                value={identifier}
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
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label="Toggle password visibility">
                {show ? <Icon.EyeOff /> : <Icon.Eye />}
              </button>
            </div>
          </label>

          {error && <div className="form-error" role="alert">{error}</div>}

          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Log in'}
          </button>

          <p className="login-note">
            Admin accounts can’t be created here. Contact the system owner if you’ve lost access.
          </p>
          <details className="demo-creds">
            <summary>Demo credentials (remove in production)</summary>
            <code>admin@omsu.edu.ph</code> or <code>admin</code> / <code>Studia@2026</code>
          </details>
        </form>
      </div>
    </div>
  );
}
