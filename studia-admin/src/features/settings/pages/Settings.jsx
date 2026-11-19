// Phase 7: the settings hub replaces the pre-phase-1 monolith (phase-0
// audit: "300 lines, three concerns in one file"). Cards for the nine
// sub-pages come from navigation.js's own children list (childrenFor), so
// adding a tenth sub-page only means editing navigation.js, not this file.
import { Link } from 'react-router-dom';
import { childrenFor } from '../../../core/config/navigation';
import { ROUTES } from '../../../core/config/routes';
import { getIcon } from '../../../shared/components/Icon';
import PageHeader from '../../../shared/components/PageHeader';

const CHILDREN = childrenFor(ROUTES.settings);

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Term, email, policies, uploads, AI and backups." />

      <div className="hub-grid">
        {CHILDREN.map((child) => {
          const ChildIcon = getIcon(child.icon ?? 'Settings');
          return (
            <Link key={child.path} to={child.path} className="hub-card">
              <span className="hub-card-icon">
                <ChildIcon />
              </span>
              <span className="hub-card-text">
                <strong>{child.label}</strong>
                <p>{child.description}</p>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
