import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
// TODO(refactor): shared must not import features - move AuthContext to core/ later
import { useAuth } from '../../features/auth/context/AuthContext';
import { Avatar, Icon } from './ui';
import GlobalSearch from './GlobalSearch';
import omsuLogo from '../../assets/omsu-logo.png';
import studiaLogo from '../../assets/studia-logo.png';

const NAV = [
  { to: '/', label: 'Home', icon: <Icon.Home />, end: true },
  { to: '/users', label: 'Users', icon: <Icon.Users /> },
  { to: '/settings', label: 'Settings', icon: <Icon.Settings /> },
];

const PAGES_WITHOUT_SEARCH = ['/users'];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e) => e.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="sidebar-logos">
          <img src={omsuLogo} alt="OMSU seal" />
          <img src={studiaLogo} alt="STUDIA Mobile" />
        </div>

        <nav>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {n.icon}
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="nav-item logout" onClick={handleLogout}>
          <Icon.Logout />
          <span>Log out</span>
        </button>
      </aside>

      {navOpen && <div className="drawer-backdrop" onClick={() => setNavOpen(false)} />}

      <main className="main">
        <div className="topbar">
          <button className="menu-btn" aria-label="Open menu" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
            <Icon.Menu />
          </button>
          {PAGES_WITHOUT_SEARCH.includes(pathname) ? <div className="topbar-spacer" /> : <GlobalSearch />}
          <div className="topbar-user">
            <Avatar name="Admin" size={38} />
            <div>
              <strong>Admin</strong>
              <small>{admin?.email}</small>
            </div>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
