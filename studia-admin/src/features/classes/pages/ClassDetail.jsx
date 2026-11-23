// Phase 5: roster, materials, assignments and announcements for one class —
// all read-only oversight, plus the one destructive action (delete the class).
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as classesRepo from '../data/classesRepository';
import { ROUTES } from '../../../core/config/routes';
import { formatBytes, formatDate, formatPercent } from '../../../core/logic/format';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import EmptyState from '../../../shared/components/EmptyState';
import { Icon } from '../../../shared/components/Icon';
import PageHeader from '../../../shared/components/PageHeader';
import { Skeleton, SkeletonCards } from '../../../shared/components/Skeleton';
import { Badge, Card, Toast } from '../../../shared/components/ui';
import { useAsync, useToast } from '../../../shared/hooks';

export default function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: cls, error, loading, reload } = useAsync((signal) => classesRepo.getClass(id, { signal }), [id]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast, showError, clearToast } = useToast();

  const runDelete = async () => {
    setBusy(true);
    try {
      await classesRepo.deleteClasses([id]);
      navigate(ROUTES.classes);
    } catch (e) {
      showError(e);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={cls?.title ?? 'Class detail'}
        subtitle="Roster, materials, assignments and announcements. Read and delete only — classes are created in the mobile app."
        breadcrumbOverrides={{ current: cls?.title }}
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
          title="This class could not load"
          message={error.message}
          action={
            <button type="button" className="btn btn-primary" onClick={reload}>
              Try again
            </button>
          }
        />
      )}

      {!loading && !error && cls && (
        <>
          <Card>
            <dl className="detail-grid">
              <div>
                <dt className="muted small">Code</dt>
                <dd>{cls.code}</dd>
              </div>
              <div>
                <dt className="muted small">Instructor</dt>
                <dd>{cls.instructorName}</dd>
              </div>
              <div>
                <dt className="muted small">Section</dt>
                <dd>{cls.sectionLabel}</dd>
              </div>
              <div>
                <dt className="muted small">Students</dt>
                <dd>{cls.studentCount}</dd>
              </div>
              <div>
                <dt className="muted small">Join code</dt>
                <dd><code>{cls.joinCode}</code></dd>
              </div>
              <div>
                <dt className="muted small">Status</dt>
                <dd><Badge>{cls.archived ? 'Archived' : 'Active'}</Badge></dd>
              </div>
              <div>
                <dt className="muted small">Created</dt>
                <dd>{formatDate(cls.createdAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Roster" subtitle={`${cls.roster.length} student${cls.roster.length === 1 ? '' : 's'} enrolled`}>
            {cls.roster.length === 0 ? (
              <p className="muted">No students enrolled yet.</p>
            ) : (
              <ul className="dt-cards">
                {cls.roster.map((s) => (
                  <li className="dt-card" key={s.id}>
                    <div className="dt-card-head">
                      <div className="dt-card-title">{s.name}</div>
                    </div>
                    <dl className="dt-card-body">
                      <div className="dt-card-row">
                        <dt>Email</dt>
                        <dd>{s.email}</dd>
                      </div>
                      <div className="dt-card-row">
                        <dt>Progress</dt>
                        <dd>{formatPercent(s.progress * 100)}</dd>
                      </div>
                      <div className="dt-card-row">
                        <dt>Submitted / Pending</dt>
                        <dd>{s.submittedCount} / {s.pendingCount}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Materials" subtitle={`${cls.materials.length} lesson${cls.materials.length === 1 ? '' : 's'}`}>
            {cls.materials.length === 0 ? (
              <p className="muted">No lessons uploaded yet.</p>
            ) : (
              <ul className="dt-cards">
                {cls.materials.map((m) => (
                  <li className="dt-card" key={m.id}>
                    <div className="dt-card-head">
                      <div className="dt-card-title">{m.title}</div>
                    </div>
                    <dl className="dt-card-body">
                      <div className="dt-card-row">
                        <dt>Type</dt>
                        <dd><Badge tone="lav">{m.kind}</Badge></dd>
                      </div>
                      <div className="dt-card-row">
                        <dt>Status</dt>
                        <dd><Badge>{m.processing}</Badge></dd>
                      </div>
                      <div className="dt-card-row">
                        <dt>Size</dt>
                        <dd>{formatBytes(m.sizeBytes)}</dd>
                      </div>
                      <div className="dt-card-row">
                        <dt>Posted</dt>
                        <dd>{formatDate(m.postedAt)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Assignments" subtitle={`${cls.assignments.length} assignment${cls.assignments.length === 1 ? '' : 's'}`}>
            {cls.assignments.length === 0 ? (
              <p className="muted">No assignments posted yet.</p>
            ) : (
              <ul className="dt-cards">
                {cls.assignments.map((a) => (
                  <li className="dt-card" key={a.id}>
                    <div className="dt-card-head">
                      <div className="dt-card-title">{a.title}</div>
                    </div>
                    <dl className="dt-card-body">
                      <div className="dt-card-row">
                        <dt>Due</dt>
                        <dd>{formatDate(a.dueAt)}</dd>
                      </div>
                      <div className="dt-card-row">
                        <dt>Points</dt>
                        <dd>{a.points}</dd>
                      </div>
                      <div className="dt-card-row">
                        <dt>Late submissions</dt>
                        <dd>{a.allowLate ? 'Allowed' : 'Not allowed'}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Announcements" subtitle={`${cls.announcements.length} posted`}>
            {cls.announcements.length === 0 ? (
              <p className="muted">No announcements posted yet.</p>
            ) : (
              <ul className="dt-cards">
                {cls.announcements.map((a) => (
                  <li className="dt-card" key={a.id}>
                    <div className="dt-card-head">
                      <div className="dt-card-title">{a.title}</div>
                      {a.pinned && <Badge tone="lav">Pinned</Badge>}
                    </div>
                    <p className="muted small">{a.body}</p>
                    <p className="muted small">{formatDate(a.postedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="danger-zone" title="Danger zone">
            <p className="muted">
              Deleting this class permanently removes its roster link, materials, assignments, quizzes and
              announcements. This cannot be undone.
            </p>
            <button type="button" className="btn btn-red" onClick={() => setConfirmOpen(true)}>
              <Icon.Trash /> Delete class
            </button>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete ${cls?.title ?? 'this class'}?`}
        confirmWord="DELETE"
        confirmLabel="Delete permanently"
        busy={busy}
        onConfirm={runDelete}
        onClose={() => setConfirmOpen(false)}
      >
        <b>{cls?.title}</b> and all of its materials, assignments, quizzes and announcements will be permanently
        removed. This cannot be undone.
      </ConfirmDialog>

      <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
    </>
  );
}
