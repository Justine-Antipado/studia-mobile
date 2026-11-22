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
import { env } from '../../config/env';
import { applyListParams } from '../../logic/mappers';
import { isStrongPassword, LOGIN_LOCK_MS, LOGIN_MAX_FAILS } from '../../logic/validation';
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
  mockSystemAnnouncements,
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
  mockSessions,
  mockLoginAttempts,
  mockVulnerabilities,
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
  email: 'admin@omsu.edu.ph',
  password: 'Studia@2026',
};

/** Human label per top-level settings key, for the audit log's one-line summary. */
const SETTINGS_SECTION_LABELS = {
  term: 'the academic term',
  email: 'Email & OTP settings',
  securityPolicy: 'the security policy',
  uploads: 'upload limits',
  system: 'system settings',
  backup: 'backup settings',
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
    adminPassword: ADMIN_ACCOUNT.password,
    otp: null, // { code, expiresAt } — the password-change OTP
    // The login OTP: { token, identifier, codeHash, expiresAt, attempts, resends, lastSentAt }
    pendingLogin: null,
    loginLock: { fails: 0, lockedUntil: 0 }, // mirrors mobile's LOGIN_MAX_FAILS / LOGIN_LOCK_MS
    classes: structuredClone(mockClasses),
    materials: structuredClone(mockMaterials),
    assignments: structuredClone(mockAssignments),
    quizzes: structuredClone(mockQuizzes),
    classAnnouncements: structuredClone(mockClassAnnouncements),
    systemAnnouncements: structuredClone(mockSystemAnnouncements),
    notifications: structuredClone(mockNotifications),
    auditLog: structuredClone(mockAuditLog),
    sessions: structuredClone(mockSessions),
    loginAttempts: structuredClone(mockLoginAttempts),
    vulnerabilities: structuredClone(mockVulnerabilities),
  };
  return database;
};

const secondsUntil = (ts) => Math.max(1, Math.ceil((ts - Date.now()) / 1000));

/** Every write and delete this admin performs is logged here — section 7's "every delete shows up in the audit log", generalized to every mutation. */
function logAudit(store, action, summary) {
  store.auditLog = [
    { id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, actor: ADMIN_ACCOUNT.name, action, summary, at: new Date().toISOString() },
    ...store.auditLog,
  ];
}

/** Wrong OTP codes allowed before the pending login is burned and the account is locked. */
const OTP_MAX_ATTEMPTS = 5;
/** How long that lock lasts (the brief's ~15 minutes). */
const OTP_LOCK_MS = 15 * 60 * 1000;
/** Resends allowed per pending login, on top of the per-resend cooldown. */
const OTP_MAX_RESENDS = 3;

/** Cryptographically random 6-digit code — never Math.random for a credential. */
function randomOtp() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

/**
 * Only the hash of a code is stored, exactly as the server must do it. This is
 * a plain SHA-256 of the code and the pending token; the real backend salts and
 * hashes with argon2id/bcrypt (see docs/api-contract.md).
 */
async function hashOtp(code, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** a••••@omsu.edu.ph — enough for the admin to recognise, not enough to leak. */
function maskEmail(email) {
  const [user = '', domain = ''] = String(email).split('@');
  const head = user.slice(0, 1);
  return `${head}${'•'.repeat(Math.max(1, Math.min(6, user.length - 1)))}@${domain}`;
}

/** The browser/OS string stored with every attempt, so a strange device stands out. */
function deviceLabel() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (!ua) return 'Unknown device';
  const browser =
    /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : 'Unknown OS';
  return `${browser} · ${os}`;
}

/** One row per login event — password, OTP sent, OTP wrong, OTP right, lockout. */
function recordLoginAttempt(store, { identifier, success, locked, stage, note }) {
  store.loginAttempts = [
    {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      identifier: String(identifier ?? '').trim(),
      success,
      locked,
      stage,
      note,
      device: deviceLabel(),
      userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
      ip: '127.0.0.1 (this device)',
      at: new Date().toISOString(),
    },
    ...store.loginAttempts,
  ];
}

/**
 * The branded mail the admin receives. In mock/dev there is no SMTP, so the
 * message — and the code — go to the console instead (the brief's dev rule).
 */
function sendOtpEmail(store, { to, code, expiryMinutes }) {
  const from = store.settings.email?.senderEmail ?? env.mailFrom;
  const body = [
    'STUDIA — Administrator sign-in',
    `Your Studia admin login code is ${code}. It expires in ${expiryMinutes} minutes.`,
    'If you did not try to sign in, change the admin password immediately.',
  ].join('\n');
  console.info(`[mock mail] from ${from} to ${to}\n${body}`);
}

export const mockBackend = {
  async login(identifier, password) {
    await delay();
    const store = db();
    const { loginLock } = store;
    // /settings/security-policy edits these live, so changing them here actually changes lockout behavior — not just a UI label.
    const maxFails = store.settings.securityPolicy?.maxLoginAttempts ?? LOGIN_MAX_FAILS;
    const lockMs = (store.settings.securityPolicy?.lockoutMinutes ?? LOGIN_LOCK_MS / 60_000) * 60_000;
    const recordAttempt = (success, locked, note) =>
      recordLoginAttempt(store, { identifier, success, locked, stage: 'password', note });

    if (loginLock.lockedUntil > Date.now()) {
      const retryAfterSec = secondsUntil(loginLock.lockedUntil);
      recordAttempt(false, true);
      throw fail(429, 'Too many failed attempts. Please wait before trying again.', {
        meta: { retryAfterSec },
      });
    }

    const id = String(identifier).trim().toLowerCase();
    const match = id === ADMIN_ACCOUNT.email.toLowerCase() || id === ADMIN_ACCOUNT.username.toLowerCase();
    // One generic message for both cases: never reveal whether the account exists.
    if (!match || password !== store.adminPassword) {
      loginLock.fails += 1;
      if (loginLock.fails >= maxFails) {
        loginLock.lockedUntil = Date.now() + lockMs;
        loginLock.fails = 0;
        recordAttempt(false, true);
        throw fail(429, 'Too many failed attempts. Please wait before trying again.', {
          meta: { retryAfterSec: secondsUntil(loginLock.lockedUntil) },
        });
      }
      recordAttempt(false, false);
      throw fail(401, 'Those credentials do not match an administrator account.', {
        meta: { attemptsLeft: maxFails - loginLock.fails },
      });
    }

    // The password was right — but the session waits for the emailed code.
    loginLock.fails = 0;
    loginLock.lockedUntil = 0;
    recordAttempt(true, false, 'Password accepted, OTP sent');

    const expiryMinutes = store.settings.email?.otpExpiryMinutes ?? 5;
    const resendSeconds = store.settings.email?.resendSeconds ?? 60;
    const pendingToken = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const code = randomOtp();

    store.pendingLogin = {
      token: pendingToken,
      identifier: String(identifier).trim(),
      // Only the hash is kept, with the expiry and the attempt count.
      codeHash: await hashOtp(code, pendingToken),
      expiresAt: Date.now() + expiryMinutes * 60 * 1000,
      attempts: 0,
      resends: 0,
      lastSentAt: Date.now(),
    };

    sendOtpEmail(store, { to: ADMIN_ACCOUNT.email, code, expiryMinutes });
    logAudit(store, 'security', 'Sent an admin login code.');

    return {
      otpRequired: true,
      pendingToken,
      maskedEmail: maskEmail(ADMIN_ACCOUNT.email),
      expiresInSec: Math.ceil(expiryMinutes * 60),
      resendInSec: resendSeconds,
      attemptsAllowed: OTP_MAX_ATTEMPTS,
    };
  },

  /**
   * Second step of every admin login. The code is single-use: whether it is
   * right or runs out of attempts, the pending login is gone afterwards.
   */
  async verifyLoginOtp(pendingToken, code) {
    await delay();
    const store = db();
    const pending = store.pendingLogin;
    const { loginLock } = store;

    if (loginLock.lockedUntil > Date.now()) {
      throw fail(429, 'Too many failed attempts. Please wait before trying again.', {
        meta: { retryAfterSec: secondsUntil(loginLock.lockedUntil) },
      });
    }

    // One generic message for a missing, stale, expired or wrong code.
    const generic = 'Invalid or expired code.';
    if (!pending || pending.token !== pendingToken || Date.now() > pending.expiresAt) {
      store.pendingLogin = null;
      recordLoginAttempt(store, {
        identifier: pending?.identifier ?? '',
        success: false,
        locked: false,
        stage: 'otp',
        note: 'Code missing or expired',
      });
      throw fail(401, generic);
    }

    const matches = (await hashOtp(String(code).trim(), pending.token)) === pending.codeHash;
    if (!matches) {
      pending.attempts += 1;
      const attemptsLeft = OTP_MAX_ATTEMPTS - pending.attempts;

      if (attemptsLeft <= 0) {
        store.pendingLogin = null;
        loginLock.lockedUntil = Date.now() + OTP_LOCK_MS;
        loginLock.fails = 0;
        recordLoginAttempt(store, {
          identifier: pending.identifier,
          success: false,
          locked: true,
          stage: 'otp',
          note: 'Code failed 5 times — login locked',
        });
        logAudit(store, 'security', 'Locked admin login after five wrong codes.');
        throw fail(429, 'Too many failed attempts. Please wait before trying again.', {
          meta: { retryAfterSec: secondsUntil(loginLock.lockedUntil) },
        });
      }

      recordLoginAttempt(store, {
        identifier: pending.identifier,
        success: false,
        locked: false,
        stage: 'otp',
        note: 'Wrong code',
      });
      throw fail(401, generic, { meta: { attemptsLeft } });
    }

    store.pendingLogin = null;
    recordLoginAttempt(store, {
      identifier: pending.identifier,
      success: true,
      locked: false,
      stage: 'otp',
      note: 'Code accepted',
    });
    logAudit(store, 'security', 'Signed in with a login code.');

    const { password: _pw, ...admin } = ADMIN_ACCOUNT;
    return { token: `mock-token-${Date.now()}`, admin: { ...admin, role: 'Admin' } };
  },

  /** A fresh code for the same pending login, rate-limited both ways. */
  async resendLoginOtp(pendingToken) {
    await delay(250);
    const store = db();
    const pending = store.pendingLogin;
    if (!pending || pending.token !== pendingToken) {
      throw fail(410, 'That sign-in attempt has expired. Please start again.');
    }

    const resendSeconds = store.settings.email?.resendSeconds ?? 60;
    const waited = (Date.now() - pending.lastSentAt) / 1000;
    if (waited < resendSeconds) {
      throw fail(429, 'Please wait before asking for another code.', {
        meta: { retryAfterSec: Math.ceil(resendSeconds - waited) },
      });
    }
    if (pending.resends >= OTP_MAX_RESENDS) {
      store.pendingLogin = null;
      throw fail(429, 'Too many codes requested. Please start again.');
    }

    const expiryMinutes = store.settings.email?.otpExpiryMinutes ?? 5;
    const code = randomOtp();
    pending.codeHash = await hashOtp(code, pending.token);
    pending.expiresAt = Date.now() + expiryMinutes * 60 * 1000;
    pending.attempts = 0;
    pending.resends += 1;
    pending.lastSentAt = Date.now();

    sendOtpEmail(store, { to: ADMIN_ACCOUNT.email, code, expiryMinutes });
    logAudit(store, 'security', 'Re-sent an admin login code.');

    return { expiresInSec: Math.ceil(expiryMinutes * 60), resendInSec: resendSeconds };
  },

  async logout() {
    await delay(120);
    return true;
  },

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

  /** params: { page, pageSize, sort, order, q, filters } -> { data, meta }. System-wide notices. */
  async getAnnouncements(params = {}) {
    await delay(200);
    const rows = [...db().systemAnnouncements].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return applyListParams(rows, { ...params, searchKeys: ['title', 'body', 'audience', 'course'] });
  },

  /** The one area admin may create content. Validated again here — the client is never the authority. */
  async createAnnouncement(input) {
    await delay();
    const title = String(input?.title ?? '').trim();
    const body = String(input?.body ?? '').trim();
    const fieldErrors = {};
    if (!title) fieldErrors.title = 'Title is required.';
    if (!body) fieldErrors.body = 'Message is required.';
    if (input?.audience === 'course' && !input?.course) fieldErrors.course = 'Select a course.';
    if (Object.keys(fieldErrors).length) throw fail(422, 'Please check the highlighted fields.', { fieldErrors });

    const now = new Date();
    const isFuture = input.scheduledAt && new Date(input.scheduledAt).getTime() > now.getTime();
    const item = {
      id: `sysann-${Date.now()}`,
      title,
      body,
      audience: input.audience,
      course: input.audience === 'course' ? input.course : null,
      status: isFuture ? 'Scheduled' : 'Published',
      scheduledAt: isFuture ? input.scheduledAt : null,
      publishedAt: isFuture ? null : now.toISOString(),
      createdAt: now.toISOString(),
    };
    const store = db();
    store.systemAnnouncements = [item, ...store.systemAnnouncements];
    logAudit(store, 'create', `${isFuture ? 'Scheduled' : 'Published'} announcement "${title}".`);
    return item;
  },

  async deleteAnnouncements(ids) {
    await delay();
    const store = db();
    store.systemAnnouncements = store.systemAnnouncements.filter((a) => !ids.includes(a.id));
    logAudit(store, 'delete', `Deleted ${ids.length} announcement${ids.length === 1 ? '' : 's'}.`);
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

  async runBackup() {
    await delay(900);
    const store = db();
    const now = new Date().toISOString();
    const point = { id: `bkp-${Date.now()}`, at: now, sizeLabel: '1.8 GB' };
    store.settings.backup = {
      lastBackupAt: now,
      lastBackupSizeLabel: point.sizeLabel,
      ok: true,
      restorePoints: [point, ...store.settings.backup.restorePoints],
    };
    logAudit(store, 'settings', 'Ran a manual backup.');
    return structuredClone(store.settings.backup);
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
    store.adminPassword = newPassword;
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

  /** Active admin sessions, not paginated — there are only ever a handful. */
  async getSessions() {
    await delay(200);
    return structuredClone(db().sessions);
  },

  async revokeSession(id) {
    await delay();
    const store = db();
    const session = store.sessions.find((s) => s.id === id);
    if (!session) throw fail(404, 'That session no longer exists.');
    if (session.current) throw fail(422, 'You cannot revoke the session you are using right now.');
    store.sessions = store.sessions.filter((s) => s.id !== id);
    logAudit(store, 'security', `Revoked a session on ${session.browser} · ${session.device}.`);
    return true;
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

  /** Security posture checklist — "scanner-style" findings. Not paginated; from the API once it exists. */
  async getVulnerabilities() {
    await delay(250);
    return structuredClone(db().vulnerabilities);
  },
};

export default mockBackend;
