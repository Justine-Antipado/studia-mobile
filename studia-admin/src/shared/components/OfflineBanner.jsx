import { useOnlineStatus } from '../hooks';
import { Icon } from './Icon';

/** Sticky strip under the topbar. Writes are blocked while it is visible. */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="offline-banner" role="alert">
      <Icon.Offline />
      <span>You are offline. Pages may be out of date and changes cannot be saved.</span>
    </div>
  );
}
