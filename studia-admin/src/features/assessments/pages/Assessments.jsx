// Phase 5: campus-wide overview of quizzes and assignments — AI-generated vs.
// manual, submission rates. Pure oversight: no create, edit or delete here,
// those happen in the instructor's app.
import { useState } from 'react';
import * as assessmentsRepo from '../data/assessmentsRepository';
import { formatDate, formatPercent } from '../../../core/logic/format';
import DataTable from '../../../shared/components/DataTable';
import EmptyState from '../../../shared/components/EmptyState';
import PageHeader from '../../../shared/components/PageHeader';
import { SkeletonCards, SkeletonTable } from '../../../shared/components/Skeleton';
import StatCard from '../../../shared/components/StatCard';
import Tabs from '../../../shared/components/Tabs';
import { Badge, Card } from '../../../shared/components/ui';
import { useAsync } from '../../../shared/hooks';

const TABS = [
  { key: 'quizzes', label: 'Quizzes' },
  { key: 'assignments', label: 'Assignments' },
];

const QUIZ_COLUMNS = [
  { key: 'title', header: 'Quiz', sortable: true, primary: true, render: (q) => (
    <div>
      <strong>{q.title}</strong>
      <div className="muted small">{q.className}</div>
    </div>
  ) },
  { key: 'source', header: 'Source', render: (q) => <Badge tone="lav">{q.source === 'AI' ? 'AI-generated' : 'Manual'}</Badge> },
  { key: 'status', header: 'Status', render: (q) => <Badge>{q.status}</Badge> },
  { key: 'questionCount', header: 'Questions' },
  { key: 'bloom', header: 'Bloom level' },
  { key: 'difficulty', header: 'Difficulty' },
  { key: 'submissionRatePct', header: 'Submission rate', render: (q) => formatPercent(q.submissionRatePct) },
  { key: 'dueAt', header: 'Due', render: (q) => (q.dueAt ? formatDate(q.dueAt) : 'No due date') },
  {
    key: 'allowLate',
    header: 'Late attempts',
    render: (q) => (
      <div>
        <Badge tone={q.allowLate ? 'green' : 'grey'}>{q.allowLate ? 'Allowed' : 'Not allowed'}</Badge>
        {q.allowLate && q.closesAt && <div className="muted small">Closes {formatDate(q.closesAt)}</div>}
      </div>
    ),
  },
  { key: 'lateAttempts', header: 'Taken late' },
];

const ASSIGNMENT_COLUMNS = [
  { key: 'title', header: 'Assignment', primary: true, render: (a) => (
    <div>
      <strong>{a.title}</strong>
      <div className="muted small">{a.className}</div>
    </div>
  ) },
  { key: 'dueAt', header: 'Due', render: (a) => formatDate(a.dueAt) },
  { key: 'points', header: 'Points' },
  {
    key: 'allowLate',
    header: 'Late submissions',
    render: (a) => (
      <div>
        <Badge tone={a.allowLate ? 'green' : 'grey'}>{a.allowLate ? 'Allowed' : 'Not allowed'}</Badge>
        {a.allowLate && a.closesAt && <div className="muted small">Closes {formatDate(a.closesAt)}</div>}
      </div>
    ),
  },
  { key: 'lateSubmissions', header: 'Turned in late' },
  { key: 'createdAt', header: 'Created', render: (a) => formatDate(a.createdAt) },
];

export default function Assessments() {
  const [tab, setTab] = useState('quizzes');
  const { data, error, loading, reload } = useAsync((signal) => assessmentsRepo.getAssessments({ signal }), []);

  return (
    <>
      <PageHeader
        title="Assessments"
        subtitle="Quizzes and assignments across the campus — AI-generated vs. manual, and submission rates."
      />

      {loading && (
        <>
          <SkeletonCards count={4} />
          <SkeletonTable rows={6} cols={6} />
        </>
      )}

      {!loading && error && (
        <EmptyState
          tone="error"
          title="Assessments could not load"
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
          <div className="stat-grid stat-grid-2">
            <StatCard label="Total quizzes" value={data.stats.totalQuizzes} />
            <StatCard label="AI-generated" value={formatPercent(data.stats.aiGeneratedPct)} />
            <StatCard label="Total assignments" value={data.stats.totalAssignments} />
            <StatCard label="Avg. submission rate" value={formatPercent(data.stats.avgSubmissionRate)} />
          </div>

          <Tabs
            aria-label="Quizzes or assignments"
            items={TABS}
            value={tab}
            onChange={setTab}
            controls="assessments-panel"
          />

          <Card id="assessments-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === 'quizzes' ? (
              <DataTable
                columns={QUIZ_COLUMNS}
                rows={data.quizzes}
                caption="Quizzes"
                emptyTitle="No quizzes yet"
                emptyMessage="Instructors haven't created any quizzes yet."
              />
            ) : (
              <DataTable
                columns={ASSIGNMENT_COLUMNS}
                rows={data.assignments}
                caption="Assignments"
                emptyTitle="No assignments yet"
                emptyMessage="Instructors haven't posted any assignments yet."
              />
            )}
          </Card>
        </>
      )}
    </>
  );
}
