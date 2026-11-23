/**
 * MOCK BACKEND — pretends to be the PHP API.
 *
 * Selected by VITE_USE_MOCK=true in core/data/api.js. It throws the same
 * ApiError shape as the HTTP client, so no component can tell the difference.
 * When the real API is live, set VITE_USE_MOCK=false; delete this folder once
 * every feature has a real endpoint.
 *
 * The single admin account is hard-coded here on purpose (admins cannot
 * register). In production the credentials live server-side, hashed.
 *
 * Nothing in this module runs at import time — the fake database is built on
 * the first call — so a VITE_USE_MOCK=false build tree-shakes the whole file,
 * admin password included.
 */
import { applyListParams } from '../../logic/mappers';
import { isStrongPassword } from '../../logic/validation';
import { fail } from '../http/errors';
import {
  mockUsers,
  mockStats,
  mockRegistrations,
  mockCourseDistribution,
  mockAiUsage,
  mockSystemHealth,
  mockActivity,
  mockSettings,
  mockNavCounts,
  mockClasses,
  mockMaterials,
  mockAssignments,
  mockQuizzes,
  mockClassAnnouncements,
  mockAiRequestsTrend,
  mockAiFeatureHealth,
  mockAiQuota,
  mockNotifications,
  mockUserGrowth,
  mockEngagementTrend,
  mockParticipationByCourse,
  mockContentConsumption,
  mockStrugglingConcepts,
  mockAuditLog,
  mockLoginAttempts,
  BLOOM_LEVELS,
  DIFFICULTIES,
} from './mockData';

/** A user's classes, read from the real classes table so a profile and a class's roster agree. */
function classesForUser(user, classes) {
  if (user.role === 'Instructor') {
    return classes
      .filter((c) => c.instructorId === user.id)
      .map((c) => ({ id: c.id, title: c.title, section: c.sectionLabel, role: 'Instructor' }));
  }
  return classes
    .filter((c) => c.studentIds.includes(user.id))
    .map((c) => ({ id: c.id, title: c.title, section: c.sectionLabel, role: 'Enrolled' }));
}

/** A student's roster row for a class detail page — deterministic, seeded from their id. */
function rosterRow(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    progress: ((user.id * 13) % 100) / 100,
    submittedCount: (user.id * 2) % 6,
    pendingCount: user.id % 3,
  };
}

function activityFor(user) {
  const lastActive = new Date(user.lastActiveAt).getTime();
  const DAY = 86_400_000;
  return [
    {
      id: `${user.id}-t1`,
      action: user.role === 'Instructor' ? 'Uploaded a lesson video.' : 'Submitted an assignment.',
      at: user.lastActiveAt,
    },
    {
      id: `${user.id}-t2`,
      action: user.role === 'Instructor' ? 'Generated an AI quiz.' : 'Completed an AI practice quiz.',
      at: new Date(lastActive - 2 * DAY).toISOString(),
    },
    { id: `${user.id}-t3`, action: 'Logged in.', at: new Date(lastActive - 5 * DAY).toISOString() },
    { id: `${user.id}-t4`, action: 'Account created.', at: user.joinedAt },
  ];
}

function aiUsageFor(user) {
  return {
    summarizer: (user.id * 3) % 40,
    planner: (user.id * 2) % 25,
    quizSynthesizer: (user.id * 5) % 30,
    chat: (user.id * 4) % 50,
  };
}

const ADMIN_ACCOUNT = {
  id: 'admin-1',
  name: 'OMSU Administrator',
  username: 'admin',
  email: 'studia.noreply2026@gmail.com',
};

/** Human label per top-level settings key, for the audit log's one-line summary. */
const SETTINGS_SECTION_LABELS = {
  legal: 'the legal text',
  ai: 'AI settings',
};

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

// The in-memory "database", created on first use and kept for the session.
let database = null;

const db = () => {
  database ??= {
    users: structuredClone(mockUsers),
    settings: structuredClone(mockSettings),
    navCounts: structuredClone(mockNavCounts),
    otp: null, // { code, expiresAt } — the password-change OTP
    classes: structuredClone(mockClasses),
    materials: structuredClone(mockMaterials),
    assignments: structuredClone(mockAssignments),
    quizzes: structuredClone(mockQuizzes),
    classAnnouncements: structuredClone(mockClassAnnouncements),
    notifications: structuredClone(mockNotifications),
    auditLog: structuredClone(mockAuditLog),
    loginAttempts: structuredClone(mockLoginAttempts),
  };
  return database;
};

/** Every write and delete this admin performs is logged here — section 7's "every delete shows up in the audit log", generalized to every mutation. */
function logAudit(store, action, summary) {
  store.auditLog = [
    { id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, actor: ADMIN_ACCOUNT.name, action, summary, at: new Date().toISOString() },
    ...store.auditLog,
  ];
}

export const mockBackend = {
  async getNavCounts() {
    await delay(150);
    const store = db();
    return {
      ...structuredClone(store.navCounts),
      unreadNotifications: store.notifications.filter((n) => !n.read).length,
    };
  },

  async getDashboard() {
    await delay();
    return {
      stats: { ...mockStats },
      registrations: mockRegistrations,
      roleDistribution: [
        { label: 'Students', value: mockStats.students },
        { label: 'Instructors', value: mockStats.instructors },
      ],
      courseDistribution: mockCourseDistribution,
      aiUsage: mockAiUsage,
      systemHealth: { ...mockSystemHealth },
      activity: mockActivity,
    };
  },

  /** params: { page, pageSize, sort, order, q, filters } -> { data, meta }. Status: 'Active' | 'Inactive'. */
  async getUsers(params = {}) {
    await delay(200);
    return applyListParams(structuredClone(db().users), {
      ...params,
      searchKeys: ['name', 'email', 'role', 'course', 'year', 'section', 'department', 'status'],
    });
  },

  /** Profile + classes + activity timeline + AI usage for /users/:id. */
  async getUser(id) {
    await delay(250);
    const store = db();
    const user = store.users.find((u) => String(u.id) === String(id));
    if (!user) throw fail(404, 'That user no longer exists.');
    const clone = structuredClone(user);
    return {
      ...clone,
      classes: classesForUser(clone, store.classes),
      activity: activityFor(clone),
      aiUsage: aiUsageFor(clone),
    };
  },

  async deleteUsers(ids) {
    await delay();
    const store = db();
    store.users = store.users.filter((u) => !ids.includes(u.id));
    logAudit(store, 'delete', `Deleted ${ids.length} user${ids.length === 1 ? '' : 's'}.`);
    return structuredClone(store.users);
  },

  /** params: { page, pageSize, sort, order, q, filters } -> { data, meta }. */
  async getClasses(params = {}) {
    await delay(200);
    const rows = db().classes.map((c) => ({ ...c, studentCount: c.studentIds.length }));
    return applyListParams(rows, {
      ...params,
      searchKeys: ['title', 'code', 'instructorName', 'course', 'sectionLabel', 'joinCode'],
    });
  },

  /** Class profile + roster + materials + assignments + announcements for /classes/:id. */
  async getClass(id) {
    await delay(250);
    const store = db();
    const cls = store.classes.find((c) => c.id === id);
    if (!cls) throw fail(404, 'That class no longer exists.');
    const usersById = new Map(store.users.map((u) => [u.id, u]));
    const roster = cls.studentIds.map((sid) => rosterRow(usersById.get(sid))).filter(Boolean);
    return {
      ...structuredClone(cls),
      studentCount: roster.length,
      roster,
      materials: store.materials.filter((m) => m.classId === id),
      assignments: store.assignments.filter((a) => a.classId === id),
      announcements: store.classAnnouncements.filter((a) => a.classId === id),
    };
  },

  /** Permanent; cascades to that class's materials, assignments, quizzes and announcements. */
  async deleteClasses(ids) {
    await delay();
    const store = db();
    store.classes = store.classes.filter((c) => !ids.includes(c.id));
    store.materials = store.materials.filter((m) => !ids.includes(m.classId));
    store.assignments = store.assignments.filter((a) => !ids.includes(a.classId));
    store.quizzes = store.quizzes.filter((q) => !ids.includes(q.classId));
    store.classAnnouncements = store.classAnnouncements.filter((a) => !ids.includes(a.classId));
    logAudit(store, 'delete', `Deleted ${ids.length} class${ids.length === 1 ? '' : 'es'}.`);
    return true;
  },

  /** params: { page, pageSize, sort, order, q, filters } -> { data, meta }. The materials library. */
  async getContent(params = {}) {
    await delay(200);
    return applyListParams(db().materials, {
      ...params,
      searchKeys: ['title', 'className', 'ownerName', 'kind', 'processing'],
    });
  },

  async deleteContent(ids) {
    await delay();
    const store = db();
    store.materials = store.materials.filter((m) => !ids.includes(m.id));
    logAudit(store, 'delete', `Deleted ${ids.length} content item${ids.length === 1 ? '' : 's'}.`);
    return true;
  },

  /** Read-only campus-wide overview: quizzes and assignments, AI-generated vs. manual, submission rates. */
  async getAssessments() {
    await delay(250);
    const store = db();
    const aiCount = store.quizzes.filter((q) => q.source === 'AI').length;
    const avgSubmissionRate = store.quizzes.length
      ? Math.round(store.quizzes.reduce((sum, q) => sum + q.submissionRatePct, 0) / store.quizzes.length)
      : 0;
    return {
      quizzes: store.quizzes,
      assignments: store.assignments,
      stats: {
        totalQuizzes: store.quizzes.length,
        aiGeneratedPct: store.quizzes.length ? Math.round((aiCount / store.quizzes.length) * 100) : 0,
        totalAssignments: store.assignments.length,
        avgSubmissionRate,
      },
    };
  },

  /**
   * params: { page, pageSize, sort, order, q, filters } -> { data, meta }.
   * The class streams: every announcement an instructor posted inside a class (what students see in the
   * mobile course > Announcements tab), with its comments. Read and delete only; posts are written in the app.
   */
  async getAnnouncements(params = {}) {
    await delay(200);
    const rows = db().classAnnouncements.map((a) => ({ ...structuredClone(a), commentCount: a.comments.length }));
    const { pinned, classId } = params.filters ?? {};
    const filtered = rows.filter(
      (a) => (!pinned || pinned === 'All' || (pinned === 'Pinned') === a.pinned) && (!classId || classId === 'All' || a.classId === classId)
    );
    const sorted = filtered.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
    return applyListParams(sorted, { ...params, filters: {}, searchKeys: ['title', 'body', 'className', 'authorName'] });
  },

  async deleteAnnouncements(ids) {
    await delay();
    const store = db();
    store.classAnnouncements = store.classAnnouncements.filter((a) => !ids.includes(a.id));
    logAudit(store, 'delete', `Deleted ${ids.length} class announcement${ids.length === 1 ? '' : 's'}.`);
    return true;
  },

  /** Usage, transcription health, AI-quiz mix and feature toggles for /ai. Not paginated. */
  async getAiHealth() {
    await delay(300);
    const store = db();
    const videos = store.materials.filter((m) => m.kind === 'video');
    const aiQuizzes = store.quizzes.filter((q) => q.source === 'AI');
    return {
      requestsTrend: mockAiRequestsTrend,
      usageByFeature: mockAiUsage,
      featureHealth: mockAiFeatureHealth,
      quota: mockAiQuota,
      toggles: { ...store.settings.ai },
      transcription: {
        queued: videos.filter((v) => v.processing === 'Processing').length,
        avgProcessingSec: 95,
        failures: videos
          .filter((v) => v.processing === 'Failed')
          .map((v) => ({ id: v.id, title: v.title, className: v.className, ownerName: v.ownerName, postedAt: v.postedAt })),
      },
      quizGeneration: {
        byBloom: BLOOM_LEVELS.map((level) => ({ label: level, value: aiQuizzes.filter((q) => q.bloom === level).length })),
        byDifficulty: DIFFICULTIES.map((d) => ({ label: d, value: aiQuizzes.filter((q) => q.difficulty === d).length })),
      },
    };
  },

  async updateAiFeature(feature, enabled) {
    await delay(200);
    const store = db();
    if (!(feature in store.settings.ai)) throw fail(404, 'Unknown AI feature.');
    store.settings.ai = { ...store.settings.ai, [feature]: enabled };
    logAudit(store, 'update', `${enabled ? 'Enabled' : 'Disabled'} the AI ${feature} feature.`);
    return { ...store.settings.ai };
  },

  /** Campus-wide analytics for /reports: engagement, content, struggling concepts, growth. Not paginated. */
  async getReports() {
    await delay(300);
    return {
      userGrowth: mockUserGrowth,
      engagementTrend: mockEngagementTrend,
      participationByCourse: mockParticipationByCourse,
      contentConsumption: mockContentConsumption,
      strugglingConcepts: mockStrugglingConcepts,
    };
  },

  /** params: { page, pageSize, sort, order, q, filters } -> { data, meta }. The admin inbox. */
  async getNotifications(params = {}) {
    await delay(200);
    const rows = [...db().notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return applyListParams(rows, { ...params, searchKeys: ['title', 'message', 'type'] });
  },

  async markNotificationRead(id, read = true) {
    await delay(150);
    const store = db();
    const notification = store.notifications.find((n) => n.id === id);
    if (!notification) throw fail(404, 'That notification no longer exists.');
    notification.read = read;
    return { ...notification };
  },

  async markAllNotificationsRead() {
    await delay(200);
    const store = db();
    store.notifications = store.notifications.map((n) => ({ ...n, read: true }));
    return true;
  },

  async getSettings() {
    await delay(200);
    return structuredClone(db().settings);
  },

  async saveSettings(patch) {
    await delay();
    const store = db();
    store.settings = { ...store.settings, ...patch };
    const section = SETTINGS_SECTION_LABELS[Object.keys(patch)[0]] ?? 'settings';
    logAudit(store, 'settings', `Updated ${section}.`);
    return structuredClone(store.settings);
  },

  // --- Password change with OTP ---
  async sendOtp() {
    await delay();
    const store = db();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    store.otp = { code, expiresAt: Date.now() + store.settings.email.otpExpiryMinutes * 60 * 1000 };
    // A real backend emails a hashed, single-use code. Logged here so the flow is testable.
    console.info('[mock] OTP sent to', ADMIN_ACCOUNT.email, '→', code);
    return { sentTo: ADMIN_ACCOUNT.email, devCode: code };
  },

  async verifyOtp(code) {
    await delay(250);
    const { otp } = db();
    if (!otp || Date.now() > otp.expiresAt) throw fail(410, 'That code has expired. Request a new one.');
    if (otp.code !== code) throw fail(422, 'Incorrect code.');
    return true;
  },

  async updatePassword(code, newPassword) {
    await delay();
    const store = db();
    if (!store.otp || store.otp.code !== code || Date.now() > store.otp.expiresAt) {
      throw fail(422, 'That code is invalid or expired.');
    }
    // Re-run the same five rules the UI checks — the client is never the only gate (docs/api-contract.md).
    if (!isStrongPassword(newPassword)) throw fail(422, 'Password does not meet all requirements.');
    store.otp = null;
    logAudit(store, 'security', 'Changed the admin password.');
    return true;
  },

  // --- Security center ---

  /** params: { page, pageSize, sort, order, q, filters: { action, from, to } } -> { data, meta }. Who did what, and when. */
  async getAuditLog(params = {}) {
    await delay(200);
    return applyListParams(db().auditLog, {
      ...params,
      searchKeys: ['actor', 'summary', 'action'],
      match: (row, key, value) => {
        if (key === 'from') return new Date(row.at) >= new Date(value);
        if (key === 'to') return new Date(row.at) <= new Date(`${value}T23:59:59`);
        return String(row[key]) === String(value);
      },
    });
  },

  /** params: { page, pageSize, sort, order, q, filters: { result } } -> { data, meta }. Failed logins, lockouts and IPs. */
  async getLoginAttempts(params = {}) {
    await delay(200);
    const rows = [...db().loginAttempts].sort((a, b) => new Date(b.at) - new Date(a.at));
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

};

export default mockBackend;
