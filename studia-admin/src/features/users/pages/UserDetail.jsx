import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as usersRepo from '../data/usersRepository';
import { ROUTES } from '../../../core/config/routes';
import { formatDate, formatDateTime, formatRelative } from '../../../core/logic/format';
import { composeSection } from '../../../core/logic/validation';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import EmptyState from '../../../shared/components/EmptyState';
import { Icon } from '../../../shared/components/Icon';
import Select from '../../../shared/components/Select';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton, SkeletonCards } from '../../../shared/components/Skeleton';
import StatCard from '../../../shared/components/StatCard';
import { Avatar, Badge, Card, Toast } from '../../../shared/components/ui';
import { useAsync, useToast } from '../../../shared/hooks';

const IMPACT_LINES = [
  ['submissions', 'assignment submission'],
  ['quizAttempts', 'quiz attempt'],
  ['lessonViews', 'lesson view'],
  ['plannerItems', 'planner item'],
  ['chatMessages', 'AI chat message'],
  ['enrolments', 'class enrolment'],
];

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: user, error, loading, reload } = useAsync((signal) => usersRepo.getUser(id, { signal }), [id]);
  const { data: impact, reload: reloadImpact } = useAsync(() => usersRepo.getUserImpact(id).catch(() => null), [id]);
  // Other active instructors, as the new owner when this instructor's classes are moved.
  const { data: instructors } = useAsync(
    (signal) =>
      user?.role === 'Instructor'
        ? usersRepo.getUsers({ page: 1, pageSize: 500, filters: { role: 'Instructor', status: 'Active' } }, { signal })
        : Promise.resolve(null),
    [user?.role]
  );
  const [dialog, setDialog] = useState(null); // 'deactivate' | 'reactivate' | 'delete' | 'reassign'
  const [newOwner, setNewOwner] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, showToast, showError, clearToast } = useToast();

  const isActive = user?.status === 'Active';
  // A new instructor account that has never been usable, as opposed to one switched off later
  // (migration 030). Same call to approve as to reactivate; different decision, different wording.
  const isPending = user?.status === 'Pending';
  const ownedClasses = impact?.classesOwned ?? 0;
  const owners = useMemo(
    () => (instructors?.data ?? []).filter((i) => i.id !== id).map((i) => ({ value: i.id, label: i.name })),
    [instructors, id]
  );
  const impactLines = impact ? IMPACT_LINES.filter(([k]) => impact[k] > 0).map(([k, w]) => `${impact[k]} ${w}${impact[k] === 1 ? '' : 's'}`) : [];

  const close = () => {
    setDialog(null);
    setNewOwner('');
  };

  const run = async (action, done) => {
    setBusy(true);
    try {
      await action();
      showToast(done);
      close();
      reload();
      reloadImpact();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

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
        subtitle="Profile, classes, activity and AI usage. Accounts are created in the mobile app; here you can deactivate or remove them."
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

          <Card className="danger-zone" title="Account access">
            {isActive && (
              <p className="muted">
                Deactivating blocks sign-in and signs the person out everywhere. Nothing is deleted
                {user.role === 'Instructor' ? ': their classes and every student&apos;s work in them stay intact' : ''}. You can reactivate at any time.
              </p>
            )}
            {isPending && (
              <p className="muted">
                This account signed up as an instructor and is waiting for your approval. It cannot sign in yet.
                Approve it only if {user.name} really is teaching staff — an instructor can create classes, publish
                lessons, grade work and see their students&apos; details.
              </p>
            )}
            {!isActive && !isPending && <p className="muted">This account is deactivated and cannot sign in.</p>}
            <div className="row-actions">
              {isActive ? (
                <button type="button" className="btn btn-primary" onClick={() => setDialog('deactivate')}>
                  <Icon.Close /> Deactivate account
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => setDialog('reactivate')}>
                  <Icon.Check /> {isPending ? 'Approve account' : 'Reactivate account'}
                </button>
              )}
              {user.role === 'Instructor' && ownedClasses > 0 && (
                <button type="button" className="btn btn-ghost" onClick={() => setDialog('reassign')}>
                  Reassign {ownedClasses} class{ownedClasses === 1 ? '' : 'es'}…
                </button>
              )}
            </div>
            <hr />
            <h3>Delete permanently</h3>
            {ownedClasses > 0 ? (
              <p className="muted">
                This instructor still owns {ownedClasses} class{ownedClasses === 1 ? '' : 'es'}, so the account cannot be deleted.
                Reassign the classes to another instructor first, or deactivate the account instead.
              </p>
            ) : (
              <p className="muted">Removes the profile and everything listed in the confirmation. This cannot be undone.</p>
            )}
            <button type="button" className="btn btn-red" disabled={ownedClasses > 0 || !impact} onClick={() => setDialog('delete')}>
              <Icon.Trash /> Delete account
            </button>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={dialog === 'deactivate'}
        title={`Deactivate ${user?.name ?? 'this user'}?`}
        confirmLabel="Deactivate"
        busy={busy}
        onConfirm={() => run(() => usersRepo.setUsersActive([id], false), 'Account deactivated.')}
        onClose={close}
      >
        <b>{user?.name}</b> will not be able to sign in and will be signed out of every device. Their data is kept.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'reactivate'}
        title={isPending ? `Approve ${user?.name ?? 'this user'} as an instructor?` : `Reactivate ${user?.name ?? 'this user'}?`}
        confirmLabel={isPending ? 'Approve' : 'Reactivate'}
        tone="primary"
        busy={busy}
        onConfirm={() =>
          run(() => usersRepo.setUsersActive([id], true), isPending ? 'Account approved.' : 'Account reactivated.')
        }
        onClose={close}
      >
        {isPending ? (
          <>
            <b>{user?.name}</b> will be able to sign in and start teaching: creating classes, publishing lessons,
            setting assessments and seeing the details of students who join.
          </>
        ) : (
          <>
            <b>{user?.name}</b> will be able to sign in again.
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'reassign'}
        title={`Reassign ${ownedClasses} class${ownedClasses === 1 ? '' : 'es'}`}
        confirmLabel="Reassign"
        tone="primary"
        busy={busy}
        confirmDisabled={!newOwner}
        onConfirm={() => run(() => usersRepo.reassignClasses(id, newOwner), 'Classes reassigned.')}
        onClose={close}
      >
        <p>Every class of <b>{user?.name}</b> moves to the instructor you pick, with all its lessons, quizzes and student work.</p>
        <div className="field">
          <span>New owner</span>
          <Select label="New owner" searchable value={newOwner} placeholder="Choose an active instructor" options={owners} onChange={setNewOwner} />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        title={`Delete ${user?.name ?? 'this user'} permanently?`}
        confirmWord="DELETE"
        confirmLabel="Delete permanently"
        busy={busy}
        onConfirm={runDelete}
        onClose={close}
      >
        <b>{user?.name}</b> and these records will be removed for good:{' '}
        {impactLines.length ? impactLines.join(', ') : 'only the profile (there is no other activity)'}. This cannot be undone.
      </ConfirmDialog>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
