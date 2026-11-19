// Phase 6: campus-wide analytics, exportable as CSV and printable — engagement,
// content consumption, struggling concepts and user growth. Read-only: nothing
// here is created, edited or deleted, only analyzed.
import { useState } from 'react';
import * as reportsRepo from '../data/reportsRepository';
import { formatPercent } from '../../../core/logic/format';
import { BarChart, LineChart } from '../../../shared/components/Charts';
import DataTable from '../../../shared/components/DataTable';
import EmptyState from '../../../shared/components/EmptyState';
import { Icon } from '../../../shared/components/Icon';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonCards, SkeletonTable } from '../../../shared/components/Skeleton';
import Tabs from '../../../shared/components/Tabs';
import { Badge, Card } from '../../../shared/components/ui';
import { useAsync } from '../../../shared/hooks';
import { downloadCsv } from '../../../shared/utils/csv';

const TABS = [
  { key: 'engagement', label: 'Engagement' },
  { key: 'content', label: 'Content' },
  { key: 'struggling', label: 'Struggling concepts' },
  { key: 'growth', label: 'User growth' },
];

const CONCEPT_COLUMNS = [
  { key: 'concept', header: 'Concept', primary: true },
  { key: 'course', header: 'Course', render: (c) => <Badge tone="lav">{c.course}</Badge> },
  { key: 'avgScorePct', header: 'Avg. score', render: (c) => formatPercent(c.avgScorePct) },
  { key: 'studentsAffected', header: 'Students affected' },
];

const GROWTH_COLUMNS = [
  { key: 'month', header: 'Month', primary: true },
  { key: 'students', header: 'New students' },
  { key: 'instructors', header: 'New instructors' },
];

const CONTENT_COLUMNS = [
  { key: 'label', header: 'Type', primary: true },
  { key: 'views', header: 'Views' },
  { key: 'completionPct', header: 'Completion', render: (c) => formatPercent(c.completionPct) },
];

/** One CSV exporter per tab — each exports exactly the rows that tab shows. */
const EXPORTERS = {
  engagement: (data) =>
    downloadCsv('studia-engagement.csv', ['Week', 'Active users'], data.engagementTrend.map((e) => [e.week, e.activeUsers])),
  content: (data) =>
    downloadCsv('studia-content-consumption.csv', ['Type', 'Views', 'Completion %'], data.contentConsumption.map((c) => [c.label, c.views, c.completionPct])),
  struggling: (data) =>
    downloadCsv('studia-struggling-concepts.csv', ['Concept', 'Course', 'Avg. score %', 'Students affected'], data.strugglingConcepts.map((c) => [c.concept, c.course, c.avgScorePct, c.studentsAffected])),
  growth: (data) =>
    downloadCsv('studia-user-growth.csv', ['Month', 'New students', 'New instructors'], data.userGrowth.map((g) => [g.month, g.students, g.instructors])),
};

export default function Reports() {
  const [tab, setTab] = useState('engagement');
  const { data, error, loading, reload } = useAsync((signal) => reportsRepo.getReports({ signal }), []);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Engagement, content consumption, struggling concepts and growth, campus-wide."
        actions={
          <>
            <button type="button" className="btn btn-ghost" disabled={!data} onClick={() => EXPORTERS[tab](data)}>
              <Icon.Download /> Export CSV
            </button>
            <button type="button" className="btn btn-ghost" disabled={!data} onClick={() => window.print()}>
              <Icon.Printer /> Print view
            </button>
          </>
        }
      />

      <Tabs aria-label="Report section" items={TABS} value={tab} onChange={setTab} controls="report-panel" />

      {loading && (
        <>
          <SkeletonCards count={2} />
          <SkeletonTable rows={5} cols={3} />
        </>
      )}

      {!loading && error && (
        <EmptyState
          tone="error"
          title="Reports could not load"
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
          {tab === 'engagement' && (
            <div className="two-col" id="report-panel" role="tabpanel" aria-labelledby="tab-engagement" tabIndex={0}>
              <Card title="Weekly active users">
                <LineChart data={data.engagementTrend} valueKey="activeUsers" labelKey="week" />
              </Card>
              <Card title="Participation by course">
                <BarChart data={data.participationByCourse} formatValue={(v) => `${v}%`} />
              </Card>
            </div>
          )}

          {tab === 'content' && (
            <div className="stack" id="report-panel" role="tabpanel" aria-labelledby="tab-content" tabIndex={0}>
              <Card title="Views by content type">
                <BarChart data={data.contentConsumption} valueKey="views" labelKey="label" />
              </Card>
              <Card>
                <DataTable columns={CONTENT_COLUMNS} rows={data.contentConsumption} rowKey={(r) => r.label} caption="Content consumption" />
              </Card>
            </div>
          )}

          {tab === 'struggling' && (
            <Card id="report-panel" role="tabpanel" aria-labelledby="tab-struggling" tabIndex={0}>
              <DataTable
                columns={CONCEPT_COLUMNS}
                rows={data.strugglingConcepts}
                caption="Struggling concepts"
                emptyTitle="No struggling concepts flagged"
                emptyMessage="Quiz performance looks healthy campus-wide."
              />
            </Card>
          )}

          {tab === 'growth' && (
            <div className="stack" id="report-panel" role="tabpanel" aria-labelledby="tab-growth" tabIndex={0}>
              <Card title="New students by month">
                <BarChart data={data.userGrowth} valueKey="students" labelKey="month" />
              </Card>
              <Card>
                <DataTable columns={GROWTH_COLUMNS} rows={data.userGrowth} rowKey={(r) => r.month} caption="User growth" />
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}
