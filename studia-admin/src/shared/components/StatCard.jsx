import { Link } from 'react-router-dom';
import { formatNumber } from '../../core/logic/format';
import { useCountUp } from '../hooks/useCountUp';

/**
 * One KPI tile: label, value, optional icon and optional trend. Numbers count
 * up on load, and passing `to` turns the whole tile into a link to the page
 * that number belongs to (Total users → Users, Classes → Classes, …).
 */
export default function StatCard({ label, value, icon, trend, tone = 'default', to }) {
  const shown = useCountUp(value);
  const className = `stat stat-card stat-${tone}` + (to ? ' stat-link' : '');

  const body = (
    <>
      <div className="stat-card-row">
        <small>{label}</small>
        {icon && <span className="stat-card-icon">{icon}</span>}
      </div>
      <strong>{typeof shown === 'number' ? formatNumber(shown) : shown}</strong>
      {trend && (
        <span className={`stat-trend ${trend.direction === 'down' ? 'down' : 'up'}`}>
          {trend.direction === 'down' ? '↓' : '↑'} {trend.label}
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
        <span className="stat-card-go" aria-hidden="true">
          →
        </span>
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
