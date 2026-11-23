/**
 * REMOTE CAMPUS ANNOUNCEMENTS — the admin's broadcast notices, straight to Supabase with the admin's
 * own session (RLS on public.platform_announcements allows only the admin). Inserting a row makes
 * the database create one `notifications` row per recipient (migration 022), which is what the
 * mobile Alerts tab shows. Same ApiError shape as every other backend.
 */
import { applyListParams } from '../../logic/mappers';
import { fail } from '../http/errors';
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
  // 42501 on a read means the request ran as anonymous (no session); on a write, RLS refused a non-admin.
  if (error.code === '42501') throw fail(401, 'Your session has ended. Please sign out and sign in again.');
  throw fail(500, fallback);
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

    const supabase = getSupabase();
    const { data: session } = await supabase.auth.getSession();
    const res = await supabase
      .from('platform_announcements')
      .insert({
        author_id: session.session?.user.id,
        title,
        body,
        audience: input.audience,
        course: input.audience === 'course' ? input.course : null,
      })
      .select(FIELDS)
      .single();
    check(res, 'The announcement could not be sent.');
    // `recipients` is filled in by the trigger after the insert; read it back.
    const fresh = await supabase.from('platform_announcements').select(FIELDS).eq('id', res.data.id).single();
    return toUi(fresh.data ?? res.data);
  },

  async deleteCampusAnnouncements(ids) {
    const res = await getSupabase().from('platform_announcements').delete().in('id', ids);
    check(res, 'The announcements could not be deleted.');
    return true;
  },
};
