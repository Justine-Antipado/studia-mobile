import { formatNumber } from '../../core/logic/format';

/**
 * One KPI tile: label, value, optional icon and optional trend. Replaces the
 * ad-hoc `.stat` markup that used to be typed out per page.
 */
export default function StatCard({ label, value, icon, trend, tone = 'default' }) {
  return (
    <div className={`stat stat-card stat-${tone}`}>
      <div className="stat-card-row">
        <small>{label}</small>
        {icon && <span className="stat-card-icon">{icon}</span>}
      </div>
      <strong>{typeof value === 'number' ? formatNumber(value) : value}</strong>
      {trend && (
        <span className={`stat-trend ${trend.direction === 'down' ? 'down' : 'up'}`}>
          {trend.direction === 'down' ? '↓' : '↑'} {trend.label}
        </span>
      )}
    </div>
  );
}
