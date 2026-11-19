// The only create flow in Academics. Split out of Announcements.jsx to keep
// that page under the house rule's ~250-line guideline.
import { useState } from 'react';
import * as announcementsRepo from '../data/announcementsRepository';
import { AUDIENCE_LABELS } from '../logic/constants';
import { COURSES, LIMITS } from '../../../core/logic/validation';
import { Modal, Toggle } from '../../../shared/components/ui';
import { useMutation } from '../../../shared/hooks';

const EMPTY_FORM = { title: '', body: '', audience: 'all', course: COURSES[0], scheduled: false, scheduledAt: '' };

/** 'YYYY-MM-DDTHH:mm' in local time, the shape a datetime-local input needs for `min`. */
function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function validate(form) {
  const errors = {};
  const title = form.title.trim();
  const body = form.body.trim();
  if (!title) errors.title = 'Title is required.';
  else if (title.length > LIMITS.announcementTitle) errors.title = `Keep it under ${LIMITS.announcementTitle} characters.`;
  if (!body) errors.body = 'Message is required.';
  else if (body.length > LIMITS.announcementBody) errors.body = `Keep it under ${LIMITS.announcementBody} characters.`;
  if (form.audience === 'course' && !form.course) errors.course = 'Select a course.';
  if (form.scheduled) {
    if (!form.scheduledAt) errors.scheduledAt = 'Pick a date and time.';
    else if (new Date(form.scheduledAt).getTime() <= Date.now()) errors.scheduledAt = 'Pick a time in the future.';
  }
  return errors;
}

export default function CreateAnnouncementModal({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  // Computed once, at mount, rather than inline in JSX on every render.
  const [minScheduleAt] = useState(() => toLocalInputValue(new Date()));
  const { mutate, pending } = useMutation(announcementsRepo.createAnnouncement);

  const submit = async () => {
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      await mutate({
        title: form.title.trim(),
        body: form.body.trim(),
        audience: form.audience,
        course: form.audience === 'course' ? form.course : null,
        scheduledAt: form.scheduled ? new Date(form.scheduledAt).toISOString() : null,
      });
      onCreated();
    } catch (e) {
      setFieldErrors(e.fieldErrors ?? {});
    }
  };

  return (
    <Modal
      title="New announcement"
      description="Posted system-wide, to the audience and schedule you choose below."
      wide
      onClose={pending ? () => {} : onClose}
      labelledBy="announcement-title"
      actions={
        <>
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>
            {pending ? 'Posting…' : form.scheduled ? 'Schedule' : 'Post now'}
          </button>
        </>
      }
    >
      <div className="stack">
        <label className="field">
          <span>Title</span>
          <input
            className="input"
            value={form.title}
            maxLength={LIMITS.announcementTitle}
            aria-invalid={!!fieldErrors.title || undefined}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          {fieldErrors.title && <p className="field-error">{fieldErrors.title}</p>}
        </label>

        <label className="field">
          <span>Message</span>
          <textarea
            className="input textarea"
            value={form.body}
            maxLength={LIMITS.announcementBody}
            aria-invalid={!!fieldErrors.body || undefined}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
          {fieldErrors.body && <p className="field-error">{fieldErrors.body}</p>}
        </label>

        <div className="two-col">
          <label className="field">
            <span>Audience</span>
            <select
              className="input"
              value={form.audience}
              onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
            >
              {Object.entries(AUDIENCE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>

          {form.audience === 'course' && (
            <label className="field">
              <span>Course</span>
              <select
                className="input"
                value={form.course}
                aria-invalid={!!fieldErrors.course || undefined}
                onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}
              >
                {COURSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {fieldErrors.course && <p className="field-error">{fieldErrors.course}</p>}
            </label>
          )}
        </div>

        <div className="switch-row">
          <span>Schedule for later</span>
          <Toggle
            checked={form.scheduled}
            label="Schedule for later"
            onChange={(scheduled) => setForm((f) => ({ ...f, scheduled }))}
          />
        </div>

        {form.scheduled && (
          <label className="field">
            <span>Publish at</span>
            <input
              type="datetime-local"
              className="input"
              value={form.scheduledAt}
              min={minScheduleAt}
              aria-invalid={!!fieldErrors.scheduledAt || undefined}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            />
            {fieldErrors.scheduledAt && <p className="field-error">{fieldErrors.scheduledAt}</p>}
          </label>
        )}
      </div>
    </Modal>
  );
}
