/**
 * REMOTE ADMIN — every admin page reads and writes the real Supabase database with the admin's own
 * session. There is no mock layer.
 *
 * Each call is a SECURITY DEFINER function from migration 025 (`admin_*`). Those functions check that
 * the caller is the active admin account and return 42501 to anyone else, so this module can never
 * widen access, and every write is audit-logged by the database. Row-level security on the tables
 * themselves is untouched.
 *
 * List endpoints return the whole (campus-sized) list and `applyListParams` does q / filter / sort /
 * paging in the browser, which keeps the SQL simple. If a table ever grows past a few thousand rows,
 * move paging into the function.
 */
import { env } from '../../config/env';
import { applyListParams, toApi, toUi } from '../../logic/mappers';
import { ApiError, ERROR_CODES, fail } from '../http/errors';
import { getSupabase } from './remoteAuth';

const API_TIMEOUT_MS = 20_000;

/** Postgres / PostgREST error -> the ApiError every page already understands. */
function toError(error, fallback) {
  const code = error?.code;
  if (code === '42501' || error?.status === 401 || error?.status === 403) {
    return fail(401, 'Your session has ended or this account is not an administrator. Please sign in again.');
  }
  if (code === 'P0002' || code === '22P02') return fail(404, 'That record no longer exists.');
  if (code === '22023') return fail(422, error.message || fallback);
  if (!error?.status && /fetch|network/i.test(error?.message ?? '')) return new ApiError({ code: ERROR_CODES.network });
  return fail(500, fallback);
}

async function rpc(name, args, { signal } = {}, fallback = 'The request could not be completed.') {
  let call = getSupabase().rpc(name, args);
  if (signal) call = call.abortSignal(signal);
  const { data, error } = await call;
  if (error) {
    if (error.name === 'AbortError' || /abort/i.test(error.message ?? '')) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    throw toError(error, fallback);
  }
  return data;
}

/** studia-api, called with the admin's access token (used for the emailed password-change code). */
async function api(path, body) {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw fail(401, 'Your session has ended. Please sign in again.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${env.apiUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new ApiError({ code: err?.name === 'AbortError' ? ERROR_CODES.timeout : ERROR_CODES.network });
  } finally {
    clearTimeout(timer);
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const e = json?.error ?? {};
    if (e.code === 'RATE_LIMITED') {
      throw new ApiError({ status: 429, code: ERROR_CODES.rateLimited, message: e.message, meta: { retryAfterSec: e.retryAfterSec } });
    }
    if (e.code === 'VALIDATION') {
      throw new ApiError({ status: 422, code: ERROR_CODES.validation, message: e.fields?.password ?? e.message, fieldErrors: e.fields ?? {} });
    }
    throw new ApiError({ status: res.status, code: e.code?.startsWith('OTP') ? ERROR_CODES.validation : undefined, message: e.message });
  }
  return json;
}

/** The API is a separate deploy, so "Server" on the dashboard is whether it answers. */
async function pingApi() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${env.apiUrl}/api/health`, { signal: ctrl.signal });
    return res.ok ? 'Online' : 'Degraded';
  } catch {
    return 'Offline';
  } finally {
    clearTimeout(timer);
  }
}

const SETTINGS_DEFAULTS = {
  email: { senderEmail: env.mailFrom, otpExpiryMinutes: 5, requireOtpForReset: true, resendSeconds: 60 },
  system: { maintenanceMode: false, appVersion: 'v1.0.0', upToDate: true, update: { required: false } },
  legal: { terms: '', privacy: '' },
  ai: { summarizer: true, planner: true, quizSynthesizer: true, chat: true, language: 'English', dailyRequestLimit: 5000 },
};

const withDefaults = (raw) => {
  const ui = toUi(raw ?? {});
  return Object.fromEntries(
    Object.entries(SETTINGS_DEFAULTS).map(([section, defaults]) => [section, { ...defaults, ...(ui[section] ?? {}) }])
  );
};

const byDate = (key) => (a, b) => new Date(b[key]) - new Date(a[key]);

export const remoteAdmin = {
  async getNavCounts(options) {
    return rpc('admin_nav_counts', {}, options);
  },

  async getDashboard(options) {
    const [data, server] = await Promise.all([
      rpc('admin_dashboard', {}, options, 'The dashboard could not load.'),
      pingApi(),
    ]);
    return { ...data, systemHealth: { ...data.systemHealth, server } };
  },

  /* ---- users ---- */
  async getUsers(params = {}, options) {
    const rows = await rpc('admin_users', {}, options, 'Users could not load.');
    return applyListParams(rows, {
      ...params,
      searchKeys: ['name', 'email', 'role', 'course', 'year', 'section', 'department', 'status'],
    });
  },

  getUser: (id, options) => rpc('admin_user', { p_id: String(id) }, options, 'This profile could not load.'),

  async deleteUsers(ids) {
    await rpc('admin_delete_users', { p_ids: ids }, {}, 'The users could not be deleted.');
    return true;
  },

  getUserImpact: (id) => rpc('admin_user_impact', { p_id: String(id) }, {}, 'The impact could not be checked.'),

  async setUsersActive(ids, active) {
    await rpc('admin_set_user_active', { p_ids: ids, p_active: active }, {}, 'The account could not be updated.');
    return true;
  },

  async reassignClasses(fromId, toId) {
    return rpc('admin_reassign_classes', { p_from: String(fromId), p_to: String(toId) }, {}, 'The classes could not be reassigned.');
  },

  /* ---- classes ---- */
  async getClasses(params = {}, options) {
    const rows = await rpc('admin_classes', {}, options, 'Classes could not load.');
    return applyListParams(rows, {
      ...params,
      searchKeys: ['title', 'code', 'instructorName', 'course', 'sectionLabel', 'joinCode'],
    });
  },

  getClass: (id, options) => rpc('admin_class', { p_id: String(id) }, options, 'This class could not load.'),

  async deleteClasses(ids) {
    await rpc('admin_delete_classes', { p_ids: ids }, {}, 'The classes could not be deleted.');
    return true;
  },

  /* ---- content ---- */
  async getContent(params = {}, options) {
    const rows = await rpc('admin_content', {}, options, 'Content could not load.');
    return applyListParams(rows, { ...params, searchKeys: ['title', 'className', 'ownerName', 'kind', 'processing'] });
  },

  async deleteContent(ids) {
    await rpc('admin_delete_content', { p_ids: ids }, {}, 'The content could not be deleted.');
    return true;
  },

  /* ---- assessments (read-only) ---- */
  getAssessments: (options) => rpc('admin_assessments', {}, options, 'Assessments could not load.'),

  /* ---- class announcement streams (moderation) ---- */
  async getAnnouncements(params = {}, options) {
    const rows = await rpc('admin_class_announcements', {}, options, 'Announcements could not load.');
    const { pinned, classId } = params.filters ?? {};
    const filtered = rows.filter(
      (a) => (!pinned || pinned === 'All' || (pinned === 'Pinned') === a.pinned) && (!classId || classId === 'All' || a.classId === classId)
    );
    return applyListParams(filtered.sort(byDate('postedAt')), { ...params, filters: {}, searchKeys: ['title', 'body', 'className', 'authorName'] });
  },

  async deleteAnnouncements(ids) {
    await rpc('admin_delete_class_announcements', { p_ids: ids }, {}, 'The announcements could not be deleted.');
    return true;
  },

  /* ---- AI ---- */
  getAiHealth: (options) => rpc('admin_ai_health', {}, options, 'AI health could not load.'),

  async updateAiFeature(feature, enabled) {
    const data = await rpc('admin_update_ai_feature', { p_feature: feature, p_enabled: enabled }, {}, 'The AI setting could not be saved.');
    return toUi(data);
  },

  /* ---- reports ---- */
  getReports: (options) => rpc('admin_reports', {}, options, 'Reports could not load.'),

  /* ---- admin inbox ---- */
  async getNotifications(params = {}, options) {
    const rows = await rpc('admin_notifications', {}, options, 'Notifications could not load.');
    return applyListParams(rows, { ...params, searchKeys: ['title', 'message', 'type'] });
  },

  markNotificationRead: (id, read = true) =>
    rpc('admin_mark_notification_read', { p_id: id, p_read: read }, {}, 'The notification could not be updated.'),

  markAllNotificationsRead: () => rpc('admin_mark_all_notifications_read', {}, {}, 'The notifications could not be updated.'),

  /* ---- settings ---- */
  async getSettings(options) {
    return withDefaults(await rpc('admin_get_settings', {}, options, 'Settings could not load.'));
  },

  async saveSettings(patch) {
    return withDefaults(await rpc('admin_save_settings', { p_patch: toApi(patch) }, {}, 'The settings could not be saved.'));
  },

  /* ---- admin password (emailed 6-digit code, same flow as the mobile app) ---- */
  async sendOtp() {
    await api('/api/me/otp-send', { purpose: 'password_change' });
    const { data } = await getSupabase().auth.getUser();
    return { sentTo: data.user?.email ?? 'your email' };
  },

  /** The server checks the code together with the new password (it is single-use), so this only checks the shape. */
  async verifyOtp(code) {
    if (!/^\d{6}$/.test(String(code))) throw fail(422, 'Enter the 6-digit code.');
    return true;
  },

  async updatePassword(code, newPassword) {
    await api('/api/me/password-change', { code, newPassword });
    return true;
  },

  /* ---- security ---- */
  async getAuditLog(params = {}, options) {
    const rows = await rpc('admin_audit_log', {}, options, 'The audit log could not load.');
    return applyListParams(rows, {
      ...params,
      searchKeys: ['actor', 'summary', 'action'],
      match: (row, key, value) => {
        if (key === 'from') return new Date(row.at) >= new Date(value);
        if (key === 'to') return new Date(row.at) <= new Date(`${value}T23:59:59`);
        return String(row[key]) === String(value);
      },
    });
  },

  async getLoginAttempts(params = {}, options) {
    const rows = await rpc('admin_login_attempts', {}, options, 'Login attempts could not load.');
    return applyListParams(rows, {
      ...params,
      searchKeys: ['identifier', 'ip'],
      match: (row, key, value) => {
        if (key !== 'result') return String(row[key]) === String(value);
        if (value === 'Locked') return row.locked;
        if (value === 'Success') return row.success;
        if (value === 'Failed') return !row.success;
        return true;
      },
    });
  },

  /* ---- push delivery ---- */
  getPushStatus: (options) => rpc('admin_push_status', {}, options, 'Push status could not load.'),
};
