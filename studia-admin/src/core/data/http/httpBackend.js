/**
 * HTTP BACKEND — the real-API twin of core/data/mock/mockBackend.js.
 *
 * Same method names, same return shapes, same ApiError. core/data/api.js picks
 * one of the two from VITE_USE_MOCK; components never know which.
 * Endpoints are documented in docs/api-contract.md (section "Admin portal").
 */
import { toApi, toList, toListParams, toUi } from '../../logic/mappers';
import { http } from './client';

const BASE = '/api/admin';

export const httpBackend = {
  login: (identifier, password) =>
    http.post(`${BASE}/auth/login`, { identifier, password }, { auth: false }).then(toUi),

  logout: () => http.post(`${BASE}/auth/logout`).then(() => true),

  getNavCounts: (options) => http.get(`${BASE}/nav-counts`, options).then(toUi),

  getDashboard: (options) => http.get(`${BASE}/dashboard`, options).then(toUi),

  /** params: { page, pageSize, sort, order, q, filters } -> { data, meta } */
  getUsers: (params = {}, options) =>
    http.get(`${BASE}/users`, { ...options, params: toListParams(params) }).then((r) => toList(r, params)),

  getUser: (id, options) => http.get(`${BASE}/users/${encodeURIComponent(id)}`, options).then(toUi),

  deleteUsers: (ids) => http.post(`${BASE}/users/delete`, { ids }).then(toUi),

  getClasses: (params = {}, options) =>
    http.get(`${BASE}/classes`, { ...options, params: toListParams(params) }).then((r) => toList(r, params)),
  getClass: (id, options) => http.get(`${BASE}/classes/${encodeURIComponent(id)}`, options).then(toUi),
  deleteClasses: (ids) => http.post(`${BASE}/classes/delete`, { ids }).then(toUi),

  getContent: (params = {}, options) =>
    http.get(`${BASE}/content`, { ...options, params: toListParams(params) }).then((r) => toList(r, params)),
  deleteContent: (ids) => http.post(`${BASE}/content/delete`, { ids }).then(toUi),

  getAssessments: (options) => http.get(`${BASE}/assessments`, options).then(toUi),

  getAnnouncements: (params = {}, options) =>
    http.get(`${BASE}/announcements`, { ...options, params: toListParams(params) }).then((r) => toList(r, params)),
  deleteAnnouncements: (ids) => http.post(`${BASE}/announcements/delete`, { ids }).then(toUi),

  getAiHealth: (options) => http.get(`${BASE}/ai`, options).then(toUi),
  updateAiFeature: (feature, enabled) => http.put(`${BASE}/ai/features/${encodeURIComponent(feature)}`, { enabled }).then(toUi),

  getReports: (options) => http.get(`${BASE}/reports`, options).then(toUi),

  getNotifications: (params = {}, options) =>
    http.get(`${BASE}/notifications`, { ...options, params: toListParams(params) }).then((r) => toList(r, params)),
  markNotificationRead: (id, read) =>
    http.put(`${BASE}/notifications/${encodeURIComponent(id)}/read`, { read }).then(toUi),
  markAllNotificationsRead: () => http.post(`${BASE}/notifications/read-all`).then(() => true),

  getSettings: (options) => http.get(`${BASE}/settings`, options).then(toUi),
  saveSettings: (patch) => http.put(`${BASE}/settings`, toApi(patch)).then(toUi),
  runBackup: () => http.post(`${BASE}/settings/backup/run`).then(toUi),

  getAuditLog: (params = {}, options) =>
    http.get(`${BASE}/security/audit-log`, { ...options, params: toListParams(params) }).then((r) => toList(r, params)),

  getSessions: (options) => http.get(`${BASE}/security/sessions`, options).then(toUi),
  revokeSession: (id) => http.post(`${BASE}/security/sessions/${encodeURIComponent(id)}/revoke`).then(() => true),

  getLoginAttempts: (params = {}, options) =>
    http.get(`${BASE}/security/login-attempts`, { ...options, params: toListParams(params) }).then((r) => toList(r, params)),

  sendOtp: () => http.post(`${BASE}/account/otp/send`).then(toUi),
  verifyOtp: (code) => http.post(`${BASE}/account/otp/verify`, { code }).then(() => true),
  updatePassword: (code, newPassword) =>
    http.post(`${BASE}/account/password`, { code, new_password: newPassword }).then(() => true),
};

export default httpBackend;
