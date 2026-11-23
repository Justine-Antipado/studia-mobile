// Two kinds of announcements, matching the mobile app:
//  - Class stream: posted by instructors inside a class (read and delete only here).
//  - Campus-wide: written by the admin and delivered to everyone's Alerts tab.
import ClassStreamPanel from '../components/ClassStreamPanel';
import CampusPanel from '../components/CampusPanel';
import PageHeader from '../../../shared/components/PageHeader';
import Tabs from '../../../shared/components/Tabs';
import { useSearchParams } from 'react-router-dom';

const TABS = [
  { key: 'class', label: 'Class stream' },
  { key: 'campus', label: 'Campus-wide' },
];

export default function Announcements() {
  const [params, setParams] = useSearchParams();
  const active = params.get('tab') === 'campus' ? 'campus' : 'class';
  // Each tab keeps its own search, sort and page, so switching starts clean.
  const switchTab = (next) => setParams(next === 'class' ? {} : { tab: next });

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={
          active === 'campus'
            ? 'Notices you send to everyone. They appear in the Alerts tab of the mobile app.'
            : 'Posts and comments instructors made inside their classes. Read and delete only.'
        }
      />
      <Tabs items={TABS} value={active} onChange={switchTab} controls="announcements-panel" aria-label="Announcement type" />
      <div id="announcements-panel" role="tabpanel" aria-labelledby={`tab-${active}`}>
        {active === 'campus' ? <CampusPanel /> : <ClassStreamPanel />}
      </div>
    </>
  );
}
