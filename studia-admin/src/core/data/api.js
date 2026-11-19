/**
 * API — the single gateway the UI talks to.
 *
 * It picks one of two interchangeable backends from VITE_USE_MOCK:
 *   mock/mockBackend.js  (in-memory, default)   http/httpBackend.js (real PHP API)
 * Both expose the same methods, shapes and ApiError, so components and feature
 * repositories never branch on the flag.
 *
 * As each feature gets built it moves its calls into
 * features/<name>/data/<name>Repository.js, which imports from this module.
 */
import { env } from '../config/env';
import { httpBackend } from './http/httpBackend';
import { mockBackend } from './mock/mockBackend';

// Compared against the raw env value so Vite inlines it as a literal: in a
// build with VITE_USE_MOCK=false the mock backend (and the admin password it
// hard-codes) is tree-shaken out of the bundle rather than just unused.
const backend = import.meta.env.VITE_USE_MOCK !== 'false' ? mockBackend : httpBackend;

/** Exposed for the "Mock data" badge in the topbar — never for business logic. */
export const isMockBackend = env.useMock;

/* --- auth --- */
export const login = (identifier, password) => backend.login(identifier, password);
export const logout = () => backend.logout();

/* --- shell --- */
export const getNavCounts = (options) => backend.getNavCounts(options);

/* --- dashboard --- */
export const getDashboard = (options) => backend.getDashboard(options);

/* --- users --- */
export const getUsers = (params, options) => backend.getUsers(params, options);
export const getUser = (id, options) => backend.getUser(id, options);
export const deleteUsers = (ids) => backend.deleteUsers(ids);

/* --- classes --- */
export const getClasses = (params, options) => backend.getClasses(params, options);
export const getClass = (id, options) => backend.getClass(id, options);
export const deleteClasses = (ids) => backend.deleteClasses(ids);

/* --- content --- */
export const getContent = (params, options) => backend.getContent(params, options);
export const deleteContent = (ids) => backend.deleteContent(ids);

/* --- assessments --- */
export const getAssessments = (options) => backend.getAssessments(options);

/* --- announcements --- */
export const getAnnouncements = (params, options) => backend.getAnnouncements(params, options);
export const createAnnouncement = (input) => backend.createAnnouncement(input);
export const deleteAnnouncements = (ids) => backend.deleteAnnouncements(ids);

/* --- ai --- */
export const getAiHealth = (options) => backend.getAiHealth(options);
export const updateAiFeature = (feature, enabled) => backend.updateAiFeature(feature, enabled);

/* --- reports --- */
export const getReports = (options) => backend.getReports(options);

/* --- notifications --- */
export const getNotifications = (params, options) => backend.getNotifications(params, options);
export const markNotificationRead = (id, read) => backend.markNotificationRead(id, read);
export const markAllNotificationsRead = () => backend.markAllNotificationsRead();

/* --- settings --- */
export const getSettings = (options) => backend.getSettings(options);
export const saveSettings = (patch) => backend.saveSettings(patch);
export const runBackup = () => backend.runBackup();

/* --- security --- */
export const getAuditLog = (params, options) => backend.getAuditLog(params, options);
export const getSessions = (options) => backend.getSessions(options);
export const revokeSession = (id) => backend.revokeSession(id);
export const getLoginAttempts = (params, options) => backend.getLoginAttempts(params, options);
export const getVulnerabilities = (options) => backend.getVulnerabilities(options);

/* --- admin account --- */
export const sendOtp = () => backend.sendOtp();
export const verifyOtp = (code) => backend.verifyOtp(code);
export const updatePassword = (code, pw) => backend.updatePassword(code, pw);
