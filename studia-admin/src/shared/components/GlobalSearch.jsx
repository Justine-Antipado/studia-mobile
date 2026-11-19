import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../core/data/api';
import { Avatar, Badge, Icon } from './ui';

const PAGES = [
  { label: 'Home', hint: 'Dashboard, stats and charts', to: '/', icon: <Icon.Home />, keywords: 'dashboard stats registrations health charts' },
  { label: 'Users', hint: 'Manage students and instructors', to: '/users', icon: <Icon.Users />, keywords: 'students instructors block unblock delete approve' },
  { label: 'Settings', hint: 'Profile, term, email and system', to: '/settings', icon: <Icon.Settings />, keywords: 'preferences configuration' },
];

// ids must match the elements rendered on the Settings page
const SETTINGS_SECTIONS = [
  { id: 'settings-profile', label: 'Profile & Password', keywords: 'otp change password account admin' },
  { id: 'settings-term', label: 'Academic Term', keywords: 'school year semester start end date' },
  { id: 'settings-email', label: 'Email & OTP', keywords: 'sender expiry resend timer reset' },
  { id: 'settings-system', label: 'System', keywords: 'maintenance mode app version' },
  { id: 'settings-backup', label: 'Backup status', keywords: 'back up now' },
  { id: 'settings-terms', label: 'Terms & Privacy', keywords: 'policy publish' },
];

const MAX_USERS = 6;

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [users, setUsers] = useState([]);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const has = (...values) => values.some((v) => v && v.toLowerCase().includes(term));
    return [
      ...PAGES.filter((p) => has(p.label, p.keywords)).map((p) => ({
        group: 'Pages', key: 'page' + p.to, label: p.label, hint: p.hint, icon: p.icon,
        go: () => navigate(p.to),
      })),
      ...SETTINGS_SECTIONS.filter((s) => has(s.label, s.keywords)).map((s) => ({
        group: 'Settings', key: s.id, label: s.label, hint: 'Settings', icon: <Icon.Settings />,
        go: () => navigate('/settings', { state: { focus: s.id } }),
      })),
      ...users.filter((u) => has(u.name, u.email, u.section)).slice(0, MAX_USERS).map((u) => ({
        group: 'Users', key: 'user' + u.id, label: u.name, hint: `${u.role} · ${u.email}`, user: u,
        go: () => navigate('/users', { state: { highlight: u.id } }),
      })),
    ];
  }, [q, users, navigate]);

  const showList = open && q.trim() !== '';

  const pick = (r) => {
    if (!r) return;
    r.go();
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[active] ?? results[0]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="search-wrap" ref={wrapRef}>
      <label className="search">
        <Icon.Search />
        <input
          ref={inputRef}
          placeholder="Search pages, settings, users…"
          value={q}
          role="combobox"
          aria-expanded={showList}
          aria-controls="search-results"
          aria-autocomplete="list"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => { setOpen(true); api.getUsers().then(setUsers).catch(() => {}); }}
          onKeyDown={onKeyDown}
        />
        {q && (
          <button type="button" className="search-clear" aria-label="Clear search" onClick={() => { setQ(''); inputRef.current?.focus(); }}>
            <Icon.Close />
          </button>
        )}
      </label>

      {showList && (
        <div className="search-results" id="search-results" role="listbox">
          {results.length === 0 ? (
            <div className="search-empty">No results for “{q.trim()}”</div>
          ) : (
            results.map((r, i) => (
              <Fragment key={r.key}>
                {(i === 0 || results[i - 1].group !== r.group) && <div className="search-group">{r.group}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={`search-item ${i === active ? 'active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(r)}
                >
                  {r.user ? <Avatar name={r.user.name} size={30} /> : <span className="search-icon">{r.icon}</span>}
                  <span className="search-text">
                    <strong>{r.label}</strong>
                    <small>{r.hint}</small>
                  </span>
                  {r.user && <Badge>{r.user.status}</Badge>}
                </button>
              </Fragment>
            ))
          )}
        </div>
      )}
    </div>
  );
}
