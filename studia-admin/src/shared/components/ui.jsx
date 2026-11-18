import { useEffect } from 'react';

export const initials = (name = '') =>
  name
    .replace(/^Prof\.\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export function Avatar({ name, size = 36 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {initials(name)}
    </div>
  );
}

const STATUS_CLASS = {
  Active: 'badge-green',
  Pending: 'badge-orange',
  Blocked: 'badge-red',
  Deactivated: 'badge-blue',
  Student: 'badge-lav',
  Instructor: 'badge-lav',
  'Up to date': 'badge-green',
};

export function Badge({ children }) {
  return <span className={`badge ${STATUS_CLASS[children] || 'badge-lav'}`}>{children}</span>;
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          {title && <h3>{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Modal({ title, children, onClose, actions }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}

export function Toast({ message, kind = 'ok', onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return <div className={`toast toast-${kind}`}>{message}</div>;
}

/* ---- Tiny inline icons (no icon library needed) ---- */
const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
export const Icon = {
  Home: () => (<svg {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>),
  Users: () => (<svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2 .6 3.2 2.3 3.5 5.2" /></svg>),
  Settings: () => (<svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>),
  Logout: () => (<svg {...p}><path d="M9 4H5v16h4" /><path d="M16 8l4 4-4 4M20 12H9" /></svg>),
  Search: () => (<svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>),
  Lock: () => (<svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>),
  Close: () => (<svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>),
  Check: () => (<svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>),
  Eye: () => (<svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>),
  EyeOff: () => (<svg {...p}><path d="M3 3l18 18M10.6 6.1A9.9 9.9 0 0112 6c6.5 0 10 6 10 6a17 17 0 01-3.2 3.9M6.6 6.6A17 17 0 002 12s3.5 6 10 6c1.7 0 3.2-.4 4.5-1" /></svg>),
  User: () => (<svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></svg>),
  Chevron: () => (<svg {...p} width="14" height="14"><path d="M9 6l6 6-6 6" /></svg>),
};
