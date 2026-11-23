import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { ROUTES } from './core/config/routes';
import ProtectedRoute from './features/auth/components/ProtectedRoute';
import ErrorBoundary from './shared/components/ErrorBoundary';
import Layout from './shared/components/Layout';
import { PageSkeleton } from './shared/components/Skeleton';

/**
 * Every page is a lazy chunk, so the first paint only downloads the login
 * screen and the shell. Routes are nested under Layout, which supplies the
 * sidebar, topbar, breadcrumbs, page transitions and the per-route
 * ErrorBoundary. Paths come from core/config/routes.js.
 */
const Login = lazy(() => import('./features/auth/pages/Login'));
const Dashboard = lazy(() => import('./features/dashboard/pages/Dashboard'));

const Users = lazy(() => import('./features/users/pages/Users'));
const UserDetail = lazy(() => import('./features/users/pages/UserDetail'));

const Classes = lazy(() => import('./features/classes/pages/Classes'));
const ClassDetail = lazy(() => import('./features/classes/pages/ClassDetail'));
const Content = lazy(() => import('./features/content/pages/Content'));
const Assessments = lazy(() => import('./features/assessments/pages/Assessments'));
const Announcements = lazy(() => import('./features/announcements/pages/Announcements'));

const AiHealth = lazy(() => import('./features/ai/pages/AiHealth'));
const Reports = lazy(() => import('./features/reports/pages/Reports'));

const Security = lazy(() => import('./features/security/pages/Security'));
const Notifications = lazy(() => import('./features/notifications/pages/Notifications'));

const Settings = lazy(() => import('./features/settings/pages/Settings'));

const Help = lazy(() => import('./features/help/pages/Help'));
const Forbidden = lazy(() => import('./features/errors/pages/Forbidden'));
const NotFound = lazy(() => import('./features/errors/pages/NotFound'));

/** /settings/legal -> /settings?tab=legal (unknown sections fall back to the first tab). */
function LegacySettingsRedirect() {
  const { section } = useParams();
  return <Navigate to={`/settings?tab=${encodeURIComponent(section)}`} replace />;
}

export default function App() {
  return (
    <ErrorBoundary title="The portal failed to start">
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path={ROUTES.login} element={<Login />} />
          <Route path={ROUTES.forbidden} element={<Forbidden />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Home was renamed to Dashboard; keep the old links working. */}
            <Route index element={<Navigate to={ROUTES.dashboard} replace />} />
            <Route path="/home" element={<Navigate to={ROUTES.dashboard} replace />} />
            <Route path={ROUTES.dashboard} element={<Dashboard />} />

            <Route path={ROUTES.users} element={<Users />} />
            <Route path={ROUTES.userDetail} element={<UserDetail />} />

            <Route path={ROUTES.classes} element={<Classes />} />
            <Route path={ROUTES.classDetail} element={<ClassDetail />} />
            <Route path={ROUTES.content} element={<Content />} />
            <Route path={ROUTES.assessments} element={<Assessments />} />
            <Route path={ROUTES.announcements} element={<Announcements />} />

            <Route path={ROUTES.ai} element={<AiHealth />} />
            <Route path={ROUTES.reports} element={<Reports />} />

            <Route path={ROUTES.notifications} element={<Notifications />} />

            <Route path={ROUTES.security} element={<Security />} />

            <Route path={ROUTES.settings} element={<Settings />} />

            {/* Old deep links: the sub-pages are now tabs of Security and Settings. */}
            <Route path="/security/audit-log" element={<Navigate to="/security?tab=audit-log" replace />} />
            <Route path="/security/login-attempts" element={<Navigate to="/security?tab=login-attempts" replace />} />
            <Route path="/settings/:section" element={<LegacySettingsRedirect />} />

            <Route path={ROUTES.help} element={<Help />} />
          </Route>

          {/* There is no register route — the admin account is fixed. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
