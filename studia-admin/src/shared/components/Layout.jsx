import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { env } from '../../core/config/env';
import { descriptionFor, titleFor } from '../../core/config/navigation';
import * as api from '../../core/data/api';
import { setNavCounts, useNavCounts } from '../../core/state/navCounts';
import { setMaintenance, useMaintenance } from '../../core/state/maintenance';
// TODO(refactor): shared/ should not import features/ — move AuthContext into core/ later.
import { useAuth } from '../../features/auth/hooks/useAuth';
import { useAsync, useDocumentTitle, useIdleTimeout } from '../hooks';
import ErrorBoundary from './ErrorBoundary';
import IdleWarning from './IdleWarning';
import MaintenanceBanner from './MaintenanceBanner';
import OfflineBanner from './OfflineBanner';
import PageTransition from './PageTransition';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // The drawer remembers which page it was opened on, so every navigation
  // closes it without an effect — including Back and Forward.
  const [drawerOn, setDrawerOn] = useState(null);
  const navOpen = drawerOn === pathname;
  const setNavOpen = useCallback((next) => setDrawerOn(next ? pathname : null), [pathname]);

  useDocumentTitle(titleFor(pathname, env.appName), descriptionFor(pathname));

  // Sidebar badges (unread notifications, …). A failure here must never break
  // the shell, so the error is swallowed and the badges simply stay empty.
  const { data: fetchedCounts } = useAsync((signal) => api.getNavCounts({ signal }), []);
  // The maintenance banner has to show on every page, so the shell owns the fetch.
  const { data: fetchedSettings } = useAsync((signal) => api.getSettings({ signal }), []);
  const maintenance = useMaintenance();
  const counts = useNavCounts();

  useEffect(() => {
    if (fetchedCounts) setNavCounts(fetchedCounts);
  }, [fetchedCounts]);

  useEffect(() => {
    if (fetchedSettings?.system) {
      setMaintenance(fetchedSettings.system.maintenance, fetchedSettings.system.maintenanceMode);
    }
  }, [fetchedSettings]);

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

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Sidebar
        open={navOpen}
        counts={counts ?? {}}
        admin={admin}
        onNavigate={() => setNavOpen(false)}
        onLogout={handleLogout}
      />

      {navOpen && <div className="drawer-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <div className="main-col">
        <Topbar
          navOpen={navOpen}
          unread={counts?.unreadNotifications ?? 0}
          onOpenNav={() => setNavOpen(true)}
        />
        <MaintenanceBanner config={maintenance} />
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
