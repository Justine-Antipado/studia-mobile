/**
 * API — the single gateway the UI talks to.
 *
 * Everything is real: Supabase Auth through studia-api for sign-in (remoteAuth), and the admin's own
 * Supabase session for every other call (remoteAdmin, remoteCampus). There is no mock backend and no
 * data source switch. Feature repositories (features/<name>/data/<name>Repository.js) import from here.
 */
import { remoteAdmin } from './remote/remoteAdmin';
import { remoteAuth } from './remote/remoteAuth';
import { remoteCampus } from './remote/remoteCampus';

/* --- auth ---
 * Admin sign-in: Supabase Auth through studia-api (role=admin, audit-logged server side). */
export const login = (identifier, password) => remoteAuth.login(identifier, password);
/** Second step of an admin login: the emailed 6-digit code (not wired server-side yet). */
export const verifyLoginOtp = (pendingToken, code) => remoteAuth.verifyLoginOtp(pendingToken, code);
export const resendLoginOtp = (pendingToken) => remoteAuth.resendLoginOtp(pendingToken);
export const logout = () => remoteAuth.logout();
/** False when the portal thinks it is signed in but Supabase has no session any more. */
export const hasSupabaseSession = () => remoteAuth.hasSession();

/* --- shell --- */
export const getNavCounts = (options) => remoteAdmin.getNavCounts(options);

/* --- dashboard --- */
export const getDashboard = (options) => remoteAdmin.getDashboard(options);

/* --- users --- */
export const getUsers = (params, options) => remoteAdmin.getUsers(params, options);
export const getUser = (id, options) => remoteAdmin.getUser(id, options);
export const deleteUsers = (ids) => remoteAdmin.deleteUsers(ids);

/* --- classes --- */
export const getClasses = (params, options) => remoteAdmin.getClasses(params, options);
export const getClass = (id, options) => remoteAdmin.getClass(id, options);
export const deleteClasses = (ids) => remoteAdmin.deleteClasses(ids);

/* --- content --- */
export const getContent = (params, options) => remoteAdmin.getContent(params, options);
export const deleteContent = (ids) => remoteAdmin.deleteContent(ids);

/* --- assessments --- */
export const getAssessments = (options) => remoteAdmin.getAssessments(options);

/* --- class announcements (moderation of the class streams) --- */
export const getAnnouncements = (params, options) => remoteAdmin.getAnnouncements(params, options);
export const deleteAnnouncements = (ids) => remoteAdmin.deleteAnnouncements(ids);

/* Campus-wide announcements: they fan out to every user's Alerts tab (and phone, via push). */
export const getCampusAnnouncements = (params) => remoteCampus.getCampusAnnouncements(params);
export const createCampusAnnouncement = (input) => remoteCampus.createCampusAnnouncement(input);
export const deleteCampusAnnouncements = (ids) => remoteCampus.deleteCampusAnnouncements(ids);
/** { devices, users, configured }: can a campus announcement reach phones right now? */
export const getPushStatus = (options) => remoteAdmin.getPushStatus(options);

/* --- ai --- */
export const getAiHealth = (options) => remoteAdmin.getAiHealth(options);
export const updateAiFeature = (feature, enabled) => remoteAdmin.updateAiFeature(feature, enabled);

/* --- reports --- */
export const getReports = (options) => remoteAdmin.getReports(options);

/* --- notifications (the admin's own inbox) --- */
export const getNotifications = (params, options) => remoteAdmin.getNotifications(params, options);
export const markNotificationRead = (id, read) => remoteAdmin.markNotificationRead(id, read);
export const markAllNotificationsRead = () => remoteAdmin.markAllNotificationsRead();

/* --- settings (maintenance, AI, legal, email) --- */
export const getSettings = (options) => remoteAdmin.getSettings(options);
export const saveSettings = (patch) => remoteAdmin.saveSettings(patch);

/* --- security --- */
export const getAuditLog = (params, options) => remoteAdmin.getAuditLog(params, options);
export const getLoginAttempts = (params, options) => remoteAdmin.getLoginAttempts(params, options);

/* --- admin account --- */
export const sendOtp = () => remoteAdmin.sendOtp();
export const verifyOtp = (code) => remoteAdmin.verifyOtp(code);
export const updatePassword = (code, pw) => remoteAdmin.updatePassword(code, pw);
