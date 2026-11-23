// One class-stream post with its comments, exactly the thread a student sees in the mobile
// course > Announcements tab. Read only: moderation is the Delete action on the list.
import { formatDateTime } from '../../../core/logic/format';
import { Badge, Modal } from '../../../shared/components/ui';

export default function AnnouncementDetailModal({ announcement, onClose }) {
  const { title, body, pinned, className, sectionLabel, authorName, postedAt, comments } = announcement;
  return (
    <Modal
      title={title}
      description={`${className} · ${sectionLabel} · posted by ${authorName} on ${formatDateTime(postedAt)}`}
      wide
      onClose={onClose}
      labelledBy="announcement-detail-title"
      actions={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="stack">
        {pinned && <Badge tone="lav">Pinned</Badge>}
        <p>{body}</p>
        <h3 className="small">Comments ({comments.length})</h3>
        {comments.length === 0 ? (
          <p className="muted">No comments yet.</p>
        ) : (
          <ul className="dt-cards">
            {comments.map((c) => (
              <li className="dt-card" key={c.id}>
                <div className="dt-card-head">
                  <div className="dt-card-title">{c.authorIsInstructor ? `Prof. ${c.author}` : c.author}</div>
                  <span className="muted small">{formatDateTime(c.postedAt)}</span>
                </div>
                <p className="muted small">{c.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
