import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { env } from '../../core/config/env';
import { descriptionFor, titleFor } from '../../core/config/navigation';
import * as api from '../../core/data/api';
// TODO(refactor): shared/ should not import features/ — move AuthContext into core/ later.
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useAsync, useDocumentTitle, useIdleTimeout, useMediaQuery } from '../hooks';
import ErrorBoundary from './ErrorBoundary';
import IdleWarning from './IdleWarning';
import OfflineBanner from './OfflineBanner';
import PageTransition from './PageTransition';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const COLLAPSE_KEY = 'studia_admin_nav_collapsed';
const DESKTOP = '(min-width: 1025px)';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
};

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isDesktop = useMediaQuery(DESKTOP);

  // The drawer remembers which page it was opened on, so every navigation
  // closes it without an effect — including Back and Forward.
  const [drawerOn, setDrawerOn] = useState(null);
  const navOpen = drawerOn === pathname;
  const setNavOpen = useCallback((next) => setDrawerOn(next ? pathname : null), [pathname]);

  const [collapsed, setCollapsed] = useState(readCollapsed);

  useDocumentTitle(titleFor(pathname, env.appName), descriptionFor(pathname));

  // Sidebar badges (unread notifications, …). A failure here must never break
  // the shell, so the error is swallowed and the badges simply stay empty.
  const { data: counts } = useAsync((signal) => api.getNavCounts({ signal }), []);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const idle = useIdleTimeout({
    minutes: env.sessionIdleMinutes,
    warnSeconds: 60,
    onTimeout: handleLogout,
  });

  // Escape closes the drawer.
  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen, setNavOpen]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <div className={`shell ${collapsed && isDesktop ? 'shell-collapsed' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Sidebar
        open={navOpen}
        collapsed={collapsed && isDesktop}
        counts={counts ?? {}}
        admin={admin}
        onNavigate={() => setNavOpen(false)}
        onToggleCollapse={toggleCollapse}
        onLogout={handleLogout}
      />

      {navOpen && <div className="drawer-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <div className="main-col">
        <Topbar
          navOpen={navOpen}
          unread={counts?.unreadNotifications ?? 0}
          onOpenNav={() => setNavOpen(true)}
        />
        <OfflineBanner />

        <main id="main" className="main">
          {/* Keyed on the pathname so a crash on one page clears when you navigate away. */}
          <ErrorBoundary key={pathname}>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </ErrorBoundary>
        </main>
      </div>

      <IdleWarning
        open={idle.warning}
        secondsLeft={idle.secondsLeft}
        onStay={idle.stay}
        onLogout={handleLogout}
      />
    </div>
  );
}
