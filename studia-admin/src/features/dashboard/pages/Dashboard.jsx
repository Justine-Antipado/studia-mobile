// Phase 4: rebuilt against the master prompt's section-5 spec — six KPI
// tiles, a registrations trend, users by role and by course, AI usage by
// feature, a storage meter, system health, a recent-activity feed and quick
// links. No search bar here (search lives inside tables, not the topbar).
import { Link } from 'react-router-dom';
import * as api from '../../../core/data/api';
import { ROUTES } from '../../../core/config/routes';
import { formatRelative } from '../../../core/logic/format';
import { BarChart, DonutChart, LineChart } from '../../../shared/components/Charts';
import EmptyState from '../../../shared/components/EmptyState';
import { Icon } from '../../../shared/components/Icon';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton, SkeletonCards } from '../../../shared/components/Skeleton';
import StatCard from '../../../shared/components/StatCard';
import { Badge, Card } from '../../../shared/components/ui';
import { useAsync } from '../../../shared/hooks';
import { C } from '../../../theme';

const QUICK_LINKS = [
  { to: ROUTES.users, label: 'Manage users', icon: 'Users' },
  { to: ROUTES.announcements, label: 'Post an announcement', icon: 'Megaphone' },
  { to: ROUTES.security, label: 'Security center', icon: 'Shield' },
  { to: ROUTES.settings, label: 'Settings', icon: 'Settings' },
];

const ACTIVITY_ICON = {
  registration: 'Users',
  ai: 'Sparkle',
  content: 'Content',
  security: 'Shield',
  announcement: 'Megaphone',
};

export default function Dashboard() {
  const { data, error, loading, reload } = useAsync((signal) => api.getDashboard({ signal }), []);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Platform activity, users and AI usage at a glance." />

      {loading && (
        <>
          <SkeletonCards count={6} />
          <div className="grid-2-1">
            <Skeleton height={260} radius="var(--radius-lg)" />
            <Skeleton height={260} radius="var(--radius-lg)" />
          </div>
        </>
      )}

      {!loading && error && (
        <EmptyState
          tone="error"
          title="The dashboard could not load"
          message={error.message}
          action={
            <button type="button" className="btn btn-primary" onClick={reload}>
              Try again
            </button>
          }
        />
      )}

      {!loading && !error && data && (
        <>
          <div className="stat-grid stat-grid-6">
            {[
              ['Total users', data.stats.totalUsers],
              ['Students', data.stats.students],
              ['Instructors', data.stats.instructors],
              ['Active today', data.stats.activeToday],
              ['Classes', data.stats.classes],
              ['AI requests', data.stats.aiRequests],
            ].map(([label, value]) => (
              <StatCard key={label} label={label} value={value} />
            ))}
          </div>

          <div className="two-col">
            <Card title="Registrations trend">
              <LineChart data={data.registrations} valueKey="count" labelKey="month" />
            </Card>
            <Card title="Users by role">
              <DonutChart
                label="Users by role"
                slices={data.roleDistribution.map((s, i) => ({ ...s, color: i === 0 ? C.primary : C.gold }))}
              />
            </Card>
          </div>

          <div className="two-col">
            <Card title="Users by course">
              <BarChart data={data.courseDistribution} valueKey="value" labelKey="label" />
            </Card>
            <Card title="AI usage by feature">
              <BarChart data={data.aiUsage} valueKey="count" labelKey="feature" />
            </Card>
          </div>

          <div className="grid-2-1">
            <Card title="System health">
              <ul className="health">
                <li>
                  Server <Badge>{data.systemHealth.server}</Badge>
                </li>
                <li>
                  AI service <Badge>{data.systemHealth.aiService}</Badge>
                </li>
                <li>
                  Database <Badge>{data.systemHealth.database}</Badge>
                </li>
                <li>
                  Queue <Badge>{data.systemHealth.queue}</Badge>
                </li>
              </ul>
              <div
                className="meter"
                role="progressbar"
                aria-label="Storage used"
                aria-valuenow={data.systemHealth.storageUsedPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  style={{
                    width: `${data.systemHealth.storageUsedPct}%`,
                    background: data.systemHealth.storageUsedPct > 85 ? 'var(--red-strong)' : 'var(--primary)',
                  }}
                />
              </div>
              <p className="muted small">{data.systemHealth.storageUsedPct}% of storage used</p>
            </Card>

            <Card title="Quick links">
              <div className="quick-links">
                {QUICK_LINKS.map((link) => {
                  const LinkIcon = Icon[link.icon];
                  return (
                    <Link key={link.to} to={link.to} className="quick-link">
                      <span className="quick-link-icon">
                        <LinkIcon />
                      </span>
                      {link.label}
                      <Icon.Chevron />
                    </Link>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card title="Recent activity">
            <ul className="feed">
              {data.activity.map((item) => {
                const ItemIcon = Icon[ACTIVITY_ICON[item.type]] ?? Icon.Info;
                return (
                  <li className="feed-item" key={item.id}>
                    <span className="feed-icon">
                      <ItemIcon />
                    </span>
                    <span className="feed-text">
                      {item.message}
                      <span className="feed-time">{formatRelative(item.at)}</span>
                    </span>
                  </li>
                );
              })}
              {data.activity.length === 0 && <li className="muted">No recent activity.</li>}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
