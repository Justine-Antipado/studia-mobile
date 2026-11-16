import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar, Icon } from './ui';
import omsuLogo from '../assets/omsu-logo.png';
import studiaLogo from '../assets/studia-logo.png';

const NAV = [
  { to: '/', label: 'Home', icon: <Icon.Home />, end: true },
  { to: '/users', label: 'Users', icon: <Icon.Users /> },
  { to: '/settings', label: 'Settings', icon: <Icon.Settings /> },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logos">
          <img src={omsuLogo} alt="OMSU seal" />
          <img src={studiaLogo} alt="STUDIA Mobile" />
        </div>

        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
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

      <main className="main">
        <div className="topbar">
          <label className="search">
            <Icon.Search />
            <input
              placeholder="Search users, classes, logs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="topbar-user">
            <Avatar name="Admin" size={38} />
            <div>
              <strong>Admin</strong>
              <small>{admin?.email}</small>
            </div>
          </div>
        </div>

        <Outlet context={{ search }} />
      </main>
    </div>
  );
}
