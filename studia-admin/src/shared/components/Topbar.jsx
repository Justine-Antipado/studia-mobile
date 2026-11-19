import { Link, useLocation } from 'react-router-dom';
import { isMockBackend } from '../../core/data/api';
import { descriptionFor, findPage } from '../../core/config/navigation';
import { Icon } from './Icon';

/**
 * Slim topbar: the drawer button on small screens, the current page name and
 * the quick links. There is deliberately NO search here — searching happens
 * inside each table and list.
 */
export default function Topbar({ onOpenNav, navOpen, unread = 0 }) {
  const { pathname } = useLocation();
  const page = findPage(pathname);

  return (
    <div className="topbar">
      <button
        type="button"
        className="menu-btn"
        aria-label="Open navigation"
        aria-expanded={navOpen}
        aria-controls="sidebar"
        onClick={onOpenNav}
      >
        <Icon.Menu />
      </button>

      <div className="topbar-context">
        <strong>{page?.title ?? 'STUDIA Admin'}</strong>
        <small className="muted">{descriptionFor(pathname)}</small>
      </div>

      <div className="topbar-right">
        {isMockBackend && (
          <span className="pill pill-warn" title="VITE_USE_MOCK=true — data is in-memory and resets on reload">
            Mock data
          </span>
        )}
        <Link to="/notifications" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Icon.Bell />
          {unread > 0 && <span className="icon-btn-dot" aria-hidden="true" />}
        </Link>
      </div>
    </div>
  );
}
