import { Link, useLocation } from 'react-router-dom';
import { breadcrumbsFor } from '../../core/config/navigation';
import { Icon } from './Icon';

/**
 * Trail built from core/config/navigation.js, so it is always in step with the
 * sidebar. `overrides` replaces a label once the record is loaded, e.g.
 * <Breadcrumbs overrides={{ '/users/:id': user.name }} />
 */
export default function Breadcrumbs({ overrides = {} }) {
  const { pathname } = useLocation();
  const trail = breadcrumbsFor(pathname);
  if (trail.length < 2) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {trail.map((crumb, i) => {
          const label = overrides[crumb.to] ?? (crumb.to === null ? overrides.current ?? crumb.label : crumb.label);
          return (
            <li key={`${crumb.label}-${i}`}>
              {crumb.to ? (
                <Link to={crumb.to}>{label}</Link>
              ) : (
                <span aria-current="page">{label}</span>
              )}
              {i < trail.length - 1 && (
                <span className="breadcrumb-sep" aria-hidden="true">
                  <Icon.Chevron />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
