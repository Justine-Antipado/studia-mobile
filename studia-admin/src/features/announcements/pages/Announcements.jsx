// One Announcements page with tabs. Both kinds match the mobile app:
//  - Class stream: posted by instructors inside a class (read and delete only here).
//  - Campus-wide: written by the admin and delivered to everyone's Alerts tab.
import ClassStreamPanel from '../components/ClassStreamPanel';
import CampusPanel from '../components/CampusPanel';
import TabbedPage from '../../../shared/components/TabbedPage';

const TABS = [
  { key: 'class', label: 'Class stream', component: ClassStreamPanel },
  { key: 'campus', label: 'Campus-wide', component: CampusPanel },
];

export default function Announcements() {
  return <TabbedPage tabs={TABS} aria-label="Announcement type" />;
}
