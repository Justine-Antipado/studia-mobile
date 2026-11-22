import { useNavigate } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs';
import { Icon } from './Icon';

/**
 * The in-page header: breadcrumbs, an optional Back button and an actions slot.
 * The title and subtitle live in the Topbar, fed by core/config/navigation.js,
 * so they are never repeated here (title/subtitle props are accepted and
 * ignored for compatibility with the pages that still pass them).
 */
export default function PageHeader({
  actions,
  back,
  breadcrumbOverrides,
  children,
}) {
  const navigate = useNavigate();

  return (
    <header className="page-header">
      <Breadcrumbs overrides={breadcrumbOverrides} />
      {(back || actions) && (
      <div className="page-header-row">
        <div className="page-header-text">
          {back && (
            <button
              type="button"
              className="back-btn"
              onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            >
              <Icon.ChevronLeft />
              <span>Back</span>
            </button>
          )}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
      )}
      {children}
    </header>
  );
}
