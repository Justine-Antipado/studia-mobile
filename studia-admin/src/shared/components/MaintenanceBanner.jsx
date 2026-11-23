import { Link } from 'react-router-dom';
import { ROUTES } from '../../core/config/routes';
import { isMaintenanceWindowOpen, maintenanceBannerLabel } from '../../core/logic/maintenance';
import { Icon } from './Icon';

/**
 * The persistent reminder that part of the mobile app is closed. It shows
 * while the window is open — including a scheduled one that has started — and
 * links straight to the switch that turns it off.
 */
export default function MaintenanceBanner({ config }) {
  if (!isMaintenanceWindowOpen(config)) return null;

  return (
    <div className="maintenance-banner" role="status">
      <Icon.Alert />
      <span>
        <strong>Maintenance active:</strong> {maintenanceBannerLabel(config)}
      </span>
      <Link to={`${ROUTES.settings}?tab=system`} className="maintenance-banner-link">
        Manage
      </Link>
    </div>
  );
}
