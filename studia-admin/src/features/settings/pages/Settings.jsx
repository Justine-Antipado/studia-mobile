// One Settings page with tabs, like Announcements: System, Legal, Account. (The AI switches live on /ai.)
import { lazy } from 'react';
import TabbedPage from '../../../shared/components/TabbedPage';

const TABS = [
  { key: 'system', label: 'System', component: lazy(() => import('./SystemSettings')) },
  { key: 'legal', label: 'Legal', component: lazy(() => import('./Legal')) },
  { key: 'account', label: 'Account', component: lazy(() => import('./Account')) },
];

export default function Settings() {
  return <TabbedPage tabs={TABS} aria-label="Settings sections" />;
}
