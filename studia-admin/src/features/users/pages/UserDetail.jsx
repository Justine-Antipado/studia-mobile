import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as usersRepo from '../data/usersRepository';
import { ROUTES } from '../../../core/config/routes';
import { formatDate, formatDateTime, formatRelative } from '../../../core/logic/format';
import { composeSection } from '../../../core/logic/validation';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import EmptyState from '../../../shared/components/EmptyState';
import { Icon } from '../../../shared/components/Icon';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton, SkeletonCards } from '../../../shared/components/Skeleton';
import StatCard from '../../../shared/components/StatCard';
import { Avatar, Badge, Card, Toast } from '../../../shared/components/ui';
import { useAsync, useToast } from '../../../shared/hooks';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: user, error, loading, reload } = useAsync((signal) => usersRepo.getUser(id, { signal }), [id]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast, showError, clearToast } = useToast();

  const runDelete = async () => {
    setBusy(true);
    try {
      await usersRepo.deleteUsers([id]);
      navigate(ROUTES.users);
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={user?.name ?? 'User profile'}
        subtitle="Profile, classes, activity and AI usage. Read and delete only — accounts are created in the mobile app."
        back={ROUTES.users}
        breadcrumbOverrides={{ current: user?.name }}
      />

      {loading && (
        <>
          <SkeletonCards count={4} />
          <Skeleton height={220} radius="var(--radius-lg)" />
        </>
      )}

      {!loading && error && (
        <EmptyState
          tone="error"
          title="This profile could not load"
          message={error.message}
          action={
            <button type="button" className="btn btn-primary" onClick={reload}>
              Try again
            </button>
          }
        />
      )}

      {!loading && !error && user && (
        <>
          <Card>
            <div className="profile-card">
              <Avatar name={user.name} size={64} />
              <div className="profile-meta">
                <h2>{user.name}</h2>
                <p className="muted">{user.email}</p>
                <div className="profile-badges">
                  <Badge>{user.role}</Badge>
                  <Badge>{user.status}</Badge>
                  <Badge tone="lav">
                    {user.role === 'Instructor' ? `Dept. ${user.department}` : composeSection(user.course, user.year, user.section)}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="two-col">
              <p>
                <strong>Joined</strong>
                <br />
                {formatDate(user.joinedAt)}
              </p>
              <p>
                <strong>Last active</strong>
                <br />
                {formatRelative(user.lastActiveAt)}
              </p>
            </div>
          </Card>

          <Card title={user.role === 'Instructor' ? 'Classes taught' : 'Enrolled classes'}>
            {user.classes.length === 0 ? (
              <p className="muted">No classes yet.</p>
            ) : (
              <ul className="dt-cards">
                {user.classes.map((c) => (
                  <li className="dt-card" key={c.id}>
                    <div className="dt-card-head">
                      <div className="dt-card-title">{c.title}</div>
                    </div>
                    <dl className="dt-card-body">
                      <div className="dt-card-row">
                        <dt>Section</dt>
                        <dd>{c.section}</dd>
                      </div>
                      <div className="dt-card-row">
                        <dt>Role</dt>
                        <dd>{c.role}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="two-col">
            <Card title="Activity timeline">
              <ul className="timeline">
                {user.activity.map((a) => (
                  <li key={a.id}>
                    <span className="timeline-dot" aria-hidden="true" />
                    <span>
                      {a.action}
                      <br />
                      <span className="muted small">{formatDateTime(a.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="AI usage">
              <div className="stat-grid stat-grid-2">
                <StatCard label="Summarizer" value={user.aiUsage.summarizer} />
                <StatCard label="Planner" value={user.aiUsage.planner} />
                <StatCard label="Quiz synthesizer" value={user.aiUsage.quizSynthesizer} />
                <StatCard label="Chat" value={user.aiUsage.chat} />
              </div>
            </Card>
          </div>

          <Card className="danger-zone" title="Danger zone">
            <p className="muted">
              Deleting this account permanently removes the profile, submissions and AI history. An instructor's classes are removed with the account. This cannot be undone.
            </p>
            <button type="button" className="btn btn-red" onClick={() => setConfirmOpen(true)}>
              <Icon.Trash /> Delete account
            </button>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete ${user?.name ?? 'this user'}?`}
        confirmWord="DELETE"
        confirmLabel="Delete permanently"
        busy={busy}
        onConfirm={runDelete}
        onClose={() => setConfirmOpen(false)}
      >
        <b>{user?.name}</b> will be permanently removed, together with their submissions and AI history (and their classes, for an instructor). This cannot be undone.
      </ConfirmDialog>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
