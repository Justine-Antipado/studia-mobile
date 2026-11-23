// One Security page with tabs, like Announcements: Overview, Audit log, Login attempts.
import { lazy } from 'react';
import TabbedPage from '../../../shared/components/TabbedPage';

const TABS = [
  { key: 'overview', label: 'Overview', component: lazy(() => import('./SecurityOverview')) },
  { key: 'audit-log', label: 'Audit log', component: lazy(() => import('./AuditLog')) },
  { key: 'login-attempts', label: 'Login attempts', component: lazy(() => import('./LoginAttempts')) },
];

export default function Security() {
  return <TabbedPage tabs={TABS} aria-label="Security sections" />;
}
