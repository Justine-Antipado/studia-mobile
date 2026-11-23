/**
 * REMOTE CAMPUS ANNOUNCEMENTS — the admin's broadcast notices.
 *  - Reading: straight from Supabase with the admin's session (RLS lets only the admin SELECT).
 *  - Sending / deleting: POST /api/admin/announcements on studia-api, which verifies the admin and
 *    writes with the service role (the session itself has no write access, migration 023).
 * Inserting a row makes the database create one `notifications` row per recipient (migration 022),
 * which is what the mobile Alerts tab shows. Same ApiError shape as every other backend.
 */
import { applyListParams } from '../../logic/mappers';
import { env } from '../../config/env';
import { ApiError, ERROR_CODES, fail } from '../http/errors';
import { getSupabase } from './remoteAuth';

const FIELDS = 'id, title, body, audience, course, recipients, created_at';

const toUi = (r) => ({
  id: r.id,
  title: r.title,
  body: r.body,
  audience: r.audience,
  course: r.course,
  recipients: r.recipients,
  createdAt: r.created_at,
});

function check({ error }, fallback) {
  if (!error) return;
  if (error.code === '42501') throw fail(403, 'Only the administrator can do that.');
  throw fail(500, fallback);
}

async function callApi(payload) {
  const { data: session } = await getSupabase().auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw fail(401, 'Your session has ended. Please sign in again.');
  let res;
  try {
    res = await fetch(`${env.apiUrl}/api/admin/announcements`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError({ code: ERROR_CODES.network });
  }
  const json = await res.json().catch(() => null);
  if (res.ok) return json;
  const e = json?.error ?? {};
  if (e.code === 'VALIDATION') throw fail(422, e.message ?? 'Please check the highlighted fields.', { fieldErrors: e.fields ?? {} });
  if (e.code === 'UNAUTHORIZED') throw fail(401, 'Your session has ended. Please sign in again.');
  throw fail(res.status >= 500 ? 500 : res.status, 'The request could not be completed.');
}

export const remoteCampus = {
  /** params: { page, pageSize, sort, order, q, filters } -> { data, meta }. */
  async getCampusAnnouncements(params = {}) {
    const res = await getSupabase().from('platform_announcements').select(FIELDS).order('created_at', { ascending: false }).limit(500);
    check(res, 'Campus announcements could not load.');
    return applyListParams((res.data ?? []).map(toUi), { ...params, searchKeys: ['title', 'body', 'course'] });
  },

  async createCampusAnnouncement(input) {
    const title = String(input?.title ?? '').trim();
    const body = String(input?.body ?? '').trim();
    const fieldErrors = {};
    if (!title) fieldErrors.title = 'Title is required.';
    else if (title.length > 140) fieldErrors.title = 'Keep it under 140 characters.';
    if (!body) fieldErrors.body = 'Message is required.';
    else if (body.length > 500) fieldErrors.body = 'Keep it under 500 characters.';
    if (input?.audience === 'course' && !input?.course) fieldErrors.course = 'Select a course.';
    if (Object.keys(fieldErrors).length) throw fail(422, 'Please check the highlighted fields.', { fieldErrors });

    const out = await callApi({
      action: 'create',
      title,
      body,
      audience: input.audience,
      ...(input.audience === 'course' ? { course: input.course } : {}),
    });
    return toUi(out.announcement);
  },

  async deleteCampusAnnouncements(ids) {
    await callApi({ action: 'delete', ids });
    return true;
  },
};
