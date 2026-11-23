// One Settings page with tabs, like Announcements: AI, System, Legal, Account.
import { lazy } from 'react';
import TabbedPage from '../../../shared/components/TabbedPage';

const TABS = [
  { key: 'ai', label: 'AI', component: lazy(() => import('./AiSettings')) },
  { key: 'system', label: 'System', component: lazy(() => import('./SystemSettings')) },
  { key: 'legal', label: 'Legal', component: lazy(() => import('./Legal')) },
  { key: 'account', label: 'Account', component: lazy(() => import('./Account')) },
];

export default function Settings() {
  return <TabbedPage tabs={TABS} aria-label="Settings sections" />;
}
