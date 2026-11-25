// One Settings page with tabs, like Announcements: Legal, Account. (The AI switches live on /ai.)
//
// The System tab is gone. It held maintenance mode and the required-update rule, which blocked the
// mobile app from core/logic/maintenance.ts -- client-side only, so a modified client could ignore it
// anyway. Removing it took the phone-side gates with it; the storage quota still lives in the same
// `settings.system` document and is read by private.storage_quota_bytes().
import { lazy } from 'react';
import TabbedPage from '../../../shared/components/TabbedPage';

const TABS = [
  { key: 'legal', label: 'Legal', component: lazy(() => import('./Legal')) },
  { key: 'account', label: 'Account', component: lazy(() => import('./Account')) },
];

export default function Settings() {
  return <TabbedPage tabs={TABS} aria-label="Settings sections" />;
}
