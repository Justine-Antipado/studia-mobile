// Compose a campus-wide announcement. Sending it creates a notification for every recipient, so it
// appears in the Alerts tab of the mobile app (students and instructors) and as a push notification.
import { useState } from 'react';
import * as announcementsRepo from '../data/announcementsRepository';
import { AUDIENCE_LABELS, CAMPUS_BODY_MAX } from '../logic/constants';
import { COURSES, LIMITS } from '../../../core/logic/validation';
import Select from '../../../shared/components/Select';
import { Modal } from '../../../shared/components/ui';
import { useMutation } from '../../../shared/hooks';

const EMPTY_FORM = { title: '', body: '', audience: 'all', course: COURSES[0] };

function validate(form) {
  const errors = {};
  const title = form.title.trim();
  const body = form.body.trim();
  if (!title) errors.title = 'Title is required.';
  else if (title.length > LIMITS.announcementTitle) errors.title = `Keep it under ${LIMITS.announcementTitle} characters.`;
  if (!body) errors.body = 'Message is required.';
  else if (body.length > CAMPUS_BODY_MAX) errors.body = `Keep it under ${CAMPUS_BODY_MAX} characters.`;
  if (form.audience === 'course' && !form.course) errors.course = 'Select a course.';
  return errors;
}

export default function CampusComposeModal({ onClose, onSent }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const { mutate, pending } = useMutation(announcementsRepo.createCampusAnnouncement);

  const submit = async () => {
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      const sent = await mutate({ title: form.title.trim(), body: form.body.trim(), audience: form.audience, course: form.course });
      onSent(sent);
    } catch (e) {
      setFieldErrors(e.fieldErrors ?? { title: e.message });
    }
  };

  return (
    <Modal
      title="New campus announcement"
      description="Sent right away. Each recipient gets it in the Alerts tab of the STUDIA app."
      wide
      onClose={pending ? () => {} : onClose}
      labelledBy="campus-announcement-title"
      actions={
        <>
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={submit}>
            {pending ? 'Sending…' : 'Send now'}
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
          <span>Message ({form.body.length}/{CAMPUS_BODY_MAX})</span>
          <textarea
            className="input textarea"
            value={form.body}
            maxLength={CAMPUS_BODY_MAX}
            aria-invalid={!!fieldErrors.body || undefined}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
          {fieldErrors.body && <p className="field-error">{fieldErrors.body}</p>}
        </label>

        <div className="two-col">
          <div className="field">
            <span>Send to</span>
            <Select
              label="Send to"
              value={form.audience}
              options={Object.entries(AUDIENCE_LABELS).map(([value, label]) => ({ value, label }))}
              onChange={(audience) => setForm((f) => ({ ...f, audience }))}
            />
          </div>
          {form.audience === 'course' && (
            <div className="field">
              <span>Course</span>
              <Select
                label="Course"
                searchable
                value={form.course}
                options={COURSES.map((c) => ({ value: c, label: c }))}
                onChange={(course) => setForm((f) => ({ ...f, course }))}
              />
              {fieldErrors.course && <p className="field-error">{fieldErrors.course}</p>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
