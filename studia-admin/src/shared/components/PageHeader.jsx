import { useNavigate } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs';
import { Icon } from './Icon';

/**
 * The one page header: breadcrumbs, optional Back, exactly one <h1>, a
 * subtitle and an actions slot. Every page renders this first.
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
  back,
  breadcrumbOverrides,
  children,
}) {
  const navigate = useNavigate();

  return (
    <header className="page-header">
      <Breadcrumbs overrides={breadcrumbOverrides} />
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
          <h1>{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
