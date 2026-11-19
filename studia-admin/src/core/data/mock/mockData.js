// Mock data — replace with real DB queries later (see core/data/api.js).
import { COURSES, composeSection, DEPARTMENT_OF_COURSE, DEPARTMENTS, SECTIONS, YEARS } from '../../logic/validation';

const STUDENT_FIRST = ['Juan', 'Ana', 'Mark', 'Liza', 'Carlo', 'Ella', 'Nico', 'Rosa', 'Paolo', 'Grace', 'Miguel', 'Jasmine', 'Rafael', 'Camille', 'Diego', 'Bea', 'Angelo', 'Trisha', 'Leo', 'Faith'];
const STUDENT_LAST = ['Dela Cruz', 'Villanueva', 'Bautista', 'Mercado', 'Dizon', 'Torres', 'Ramos', 'Fernandez', 'Garcia', 'Lopez', 'Aquino', 'Santiago'];
const INSTRUCTOR_FIRST = ['Maria', 'Ramon', 'Teresa', 'Gerardo', 'Luz', 'Victor', 'Carmela', 'Danilo'];
const INSTRUCTOR_LAST = ['Santos', 'Reyes', 'Navarro', 'Castillo', 'Pascual', 'Ocampo', 'Lim', 'Padilla'];

const TODAY = new Date(2026, 10, 20); // 2026-11-20, matches the environment's "today"

const emailOf = (first, last) => `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@omsu.edu.ph';

function isoDaysAgo(days, hour = 9) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function buildStudents(count) {
  return Array.from({ length: count }, (_, i) => {
    const first = STUDENT_FIRST[i % STUDENT_FIRST.length];
    const last = STUDENT_LAST[i % STUDENT_LAST.length];
    return {
      id: i + 1,
      name: `${first} ${last}`,
      email: emailOf(first, last),
      role: 'Student',
      course: COURSES[i % COURSES.length],
      year: YEARS[i % YEARS.length],
      section: SECTIONS[i % SECTIONS.length],
      department: null,
      status: i % 6 === 5 ? 'Inactive' : 'Active',
      joinedAt: isoDaysAgo(96 - ((i * 7) % 95)),
      lastActiveAt: isoDaysAgo((i * 3) % 20, 8 + (i % 10)),
    };
  });
}

function buildInstructors(count, offset) {
  return Array.from({ length: count }, (_, i) => {
    const first = INSTRUCTOR_FIRST[i % INSTRUCTOR_FIRST.length];
    const last = INSTRUCTOR_LAST[(i + 3) % INSTRUCTOR_LAST.length];
    return {
      id: offset + i + 1,
      name: `Prof. ${first} ${last}`,
      email: emailOf(first, last),
      role: 'Instructor',
      course: null,
      year: null,
      section: null,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      status: i % 7 === 6 ? 'Inactive' : 'Active',
      joinedAt: isoDaysAgo(150 - ((i * 11) % 140)),
      lastActiveAt: isoDaysAgo((i * 2) % 15, 9 + (i % 8)),
    };
  });
}

const STUDENT_COUNT = 20;
export const mockUsers = [...buildStudents(STUDENT_COUNT), ...buildInstructors(8, STUDENT_COUNT)];

const mockStudents = mockUsers.filter((u) => u.role === 'Student');
const mockInstructors = mockUsers.filter((u) => u.role === 'Instructor');

const CLASS_SUBJECTS = {
  BSIT: ['Data Structures & Algorithms', 'Web Application Development', 'Database Management Systems', 'Mobile App Development'],
  BEED: ['Child Development', 'Curriculum Design', 'Educational Technology', 'Classroom Management'],
  'BSBA-FM': ['Financial Management', 'Investment Analysis', 'Corporate Finance', 'Risk Management'],
  'BSBA-OM': ['Operations Research', 'Supply Chain Management', 'Quality Management', 'Production Planning'],
};

/** 6-char uppercase alnum join code, deterministic from a sequence number. */
const joinCodeFor = (seq) => (seq * 48271 % 36 ** 6).toString(36).toUpperCase().padStart(6, '0');

function buildClasses() {
  const classes = [];
  let seq = 1;
  for (const course of COURSES) {
    const dept = DEPARTMENT_OF_COURSE[course];
    const deptInstructors = mockInstructors.filter((i) => i.department === dept);
    const subjects = CLASS_SUBJECTS[course];
    YEARS.forEach((year, yi) => {
      const instructor = deptInstructors[yi % deptInstructors.length] ?? mockInstructors[yi % mockInstructors.length];
      const section = 'A';
      const studentIds = mockStudents.filter((s) => s.course === course && s.year === year).map((s) => s.id);
      classes.push({
        id: `cls-${seq}`,
        code: `${course.replace('BSBA-', 'BA')}${year}0${yi + 1}`,
        title: subjects[yi % subjects.length],
        instructorId: instructor.id,
        instructorName: instructor.name,
        course,
        year,
        section,
        sectionLabel: composeSection(course, year, section),
        joinCode: joinCodeFor(seq),
        archived: seq % 7 === 0,
        createdAt: isoDaysAgo(220 - seq * 9),
        studentIds,
      });
      seq += 1;
    });
  }
  return classes;
}

export const mockClasses = buildClasses();

const MATERIAL_KINDS = ['video', 'pdf', 'slide'];

function buildMaterials() {
  const items = [];
  let seq = 1;
  for (const cls of mockClasses) {
    const count = cls.archived ? 1 : 2 + (seq % 2);
    for (let i = 0; i < count; i += 1) {
      const kind = MATERIAL_KINDS[(seq + i) % MATERIAL_KINDS.length];
      items.push({
        id: `mat-${seq}`,
        classId: cls.id,
        className: cls.title,
        title: `${cls.title} — Lesson ${i + 1}`,
        kind,
        processing: seq % 11 === 0 ? 'Failed' : seq % 5 === 0 ? 'Processing' : 'Ready',
        sizeBytes: kind === 'video' ? 180_000_000 + seq * 4_000_000 : 1_800_000 + seq * 90_000,
        ownerId: cls.instructorId,
        ownerName: cls.instructorName,
        postedAt: isoDaysAgo(95 - seq),
      });
      seq += 1;
    }
  }
  return items;
}

export const mockMaterials = buildMaterials();

function buildAssignments() {
  const items = [];
  let seq = 1;
  for (const cls of mockClasses) {
    if (cls.archived) continue;
    items.push({
      id: `asg-${seq}`,
      classId: cls.id,
      className: cls.title,
      title: `${cls.title} — Project ${seq}`,
      dueAt: isoDaysAgo(-(((seq * 3) % 10) + 1)),
      points: 50 + (seq % 5) * 10,
      allowLate: seq % 3 !== 0,
      createdAt: isoDaysAgo(18 + seq),
    });
    seq += 1;
  }
  return items;
}

export const mockAssignments = buildAssignments();

export const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

function buildQuizzes() {
  const items = [];
  let seq = 1;
  for (const cls of mockClasses) {
    if (cls.archived) continue;
    items.push({
      id: `qz-${seq}`,
      classId: cls.id,
      className: cls.title,
      title: `${cls.title} — Quiz ${seq}`,
      source: seq % 2 === 0 ? 'AI' : 'Manual',
      status: seq % 4 === 0 ? 'Draft' : 'Published',
      questionCount: 8 + (seq % 5) * 2,
      bloom: BLOOM_LEVELS[seq % BLOOM_LEVELS.length],
      difficulty: DIFFICULTIES[seq % DIFFICULTIES.length],
      submissionRatePct: 40 + ((seq * 7) % 55),
      createdAt: isoDaysAgo(28 + seq),
    });
    seq += 1;
  }
  return items;
}

export const mockQuizzes = buildQuizzes();

function buildClassAnnouncements() {
  const items = [];
  let seq = 1;
  for (const cls of mockClasses) {
    items.push({
      id: `cann-${seq}`,
      classId: cls.id,
      title: 'Midterm schedule',
      body: 'Midterm exams start next week. Check the course calendar for your slot.',
      postedAt: isoDaysAgo(5 + seq),
      pinned: seq % 4 === 0,
    });
    seq += 1;
  }
  return items;
}

export const mockClassAnnouncements = buildClassAnnouncements();

/** System-wide notices the admin posts from /announcements — the one area admin may create content. */
export const mockSystemAnnouncements = [
  {
    id: 'sysann-1',
    title: 'Midterm examination schedule',
    body: 'Midterm exams run November 24–28. Check your class announcements for room assignments.',
    audience: 'all',
    course: null,
    status: 'Published',
    scheduledAt: null,
    publishedAt: isoDaysAgo(2, 8),
    createdAt: isoDaysAgo(2, 8),
  },
  {
    id: 'sysann-2',
    title: 'Server maintenance window',
    body: 'STUDIA will be briefly unavailable on Nov 23, 1:00–2:00 AM for scheduled maintenance.',
    audience: 'all',
    course: null,
    status: 'Scheduled',
    scheduledAt: isoDaysAgo(-3, 1),
    publishedAt: null,
    createdAt: isoDaysAgo(0, 10),
  },
  {
    id: 'sysann-3',
    title: 'BSIT curriculum update',
    body: 'BSIT students: the updated prospectus for AY 2026–2027 is now available from your adviser.',
    audience: 'course',
    course: 'BSIT',
    status: 'Published',
    scheduledAt: null,
    publishedAt: isoDaysAgo(6, 9),
    createdAt: isoDaysAgo(6, 9),
  },
];

export const mockStats = {
  totalUsers: 1284,
  students: 1196,
  instructors: 88,
  activeToday: 412,
  classes: 86,
  aiRequests: 2340,
};

export const mockRegistrations = [
  { month: 'Jun', count: 60 },
  { month: 'Jul', count: 110 },
  { month: 'Aug', count: 85 },
  { month: 'Sep', count: 140 },
  { month: 'Oct', count: 120 },
  { month: 'Nov', count: 175 },
];

// Sums to stats.students (1196), so the chart and the KPI tile agree.
export const mockCourseDistribution = [
  { label: 'BSIT', value: 480 },
  { label: 'BEED', value: 320 },
  { label: 'BSBA-FM', value: 250 },
  { label: 'BSBA-OM', value: 146 },
];

export const mockAiUsage = [
  { feature: 'Summarizer', count: 940 },
  { feature: 'Planner', count: 610 },
  { feature: 'Quiz synth.', count: 505 },
  { feature: 'Chat', count: 285 },
];

// unreadNotifications is derived from mockNotifications (below) by the mock
// backend, not stored here, so the sidebar badge and the inbox can never
// disagree.
export const mockNavCounts = {};

export const mockSystemHealth = {
  storageUsedPct: 62,
  server: 'Online',
  aiService: 'Operational',
  database: 'Online',
  queue: 'Operational',
};

// A generic platform feed — independent of the mock user list, since it
// stands in for events across users, classes, content and security that no
// single domain's mock data models yet.
export const mockActivity = [
  { id: 'a1', type: 'registration', message: 'Juan Dela Cruz registered as a Student.', at: isoDaysAgo(0, 7) },
  { id: 'a2', type: 'ai', message: 'AI quiz synthesizer generated 12 questions for BSIT 3-A.', at: isoDaysAgo(0, 6) },
  { id: 'a3', type: 'content', message: 'Prof. Maria Santos uploaded a new lesson video.', at: isoDaysAgo(1, 15) },
  { id: 'a4', type: 'security', message: 'Admin login from a new device.', at: isoDaysAgo(1, 9) },
  { id: 'a5', type: 'announcement', message: 'System-wide announcement published: "Midterm schedule".', at: isoDaysAgo(2, 11) },
  { id: 'a6', type: 'registration', message: 'Ella Fernandez registered as a Student.', at: isoDaysAgo(3, 14) },
];

export const mockSettings = {
  term: { schoolYear: '2026–2027', semester: '1st Semester', startDate: '2026-08-11', endDate: '2026-12-18' },
  email: { senderEmail: 'no-reply@omsu.edu.ph', otpExpiryMinutes: 5, requireOtpForReset: true, resendSeconds: 60 },
  // Mirrors studia-mobile's auth-service.ts defaults (LOGIN_MAX_FAILS 5, LOGIN_LOCK_MS 60s = 1 min);
  // mockBackend.login reads these live, so changing them here actually changes lockout behavior.
  securityPolicy: { minPasswordLength: 8, requireUppercase: true, requireNumber: true, requireSymbol: true, sessionTimeoutMinutes: 20, maxLoginAttempts: 5, lockoutMinutes: 1 },
  uploads: { allowedTypes: ['mp4', 'mov', 'pdf', 'pptx', 'docx'], maxVideoSizeMb: 500, maxDocumentSizeMb: 25, storageQuotaGb: 50 },
  system: { maintenanceMode: false, appVersion: 'v1.0.0', upToDate: true },
  backup: {
    lastBackupAt: isoDaysAgo(4, 2),
    lastBackupSizeLabel: '1.8 GB',
    ok: true,
    restorePoints: [
      { id: 'bkp-1', at: isoDaysAgo(4, 2), sizeLabel: '1.8 GB' },
      { id: 'bkp-2', at: isoDaysAgo(11, 2), sizeLabel: '1.7 GB' },
      { id: 'bkp-3', at: isoDaysAgo(18, 2), sizeLabel: '1.6 GB' },
      { id: 'bkp-4', at: isoDaysAgo(25, 2), sizeLabel: '1.6 GB' },
    ],
  },
  legal: {
    terms: '1. Using STUDIA — provided by OMSU Mamburao Campus for learning and academic activities.',
    privacy: 'STUDIA collects only the account and academic data needed to run classes, lessons and AI features for OMSU Mamburao Campus. Data is never sold or shared outside the university.',
  },
  // Read by /ai (toggles) and /settings/ai (the same switches plus language/limits)
  // — one source so the two pages can never disagree.
  ai: { summarizer: true, planner: true, quizSynthesizer: true, chat: true, language: 'English', dailyRequestLimit: 5000 },
};

/** Who did what, when — every delete and write this admin performs is logged here. Newest first. */
export const mockAuditLog = [
  { id: 'log-1', actor: 'OMSU Administrator', action: 'delete', summary: 'Deleted 1 user account.', at: isoDaysAgo(0, 9) },
  { id: 'log-2', actor: 'OMSU Administrator', action: 'create', summary: 'Published announcement "Midterm schedule".', at: isoDaysAgo(1, 11) },
  { id: 'log-3', actor: 'OMSU Administrator', action: 'settings', summary: 'Updated Email & OTP settings.', at: isoDaysAgo(2, 15) },
  { id: 'log-4', actor: 'OMSU Administrator', action: 'security', summary: 'Changed the admin password.', at: isoDaysAgo(3, 10) },
  { id: 'log-5', actor: 'OMSU Administrator', action: 'update', summary: 'Disabled the AI chat feature.', at: isoDaysAgo(4, 13) },
  { id: 'log-6', actor: 'OMSU Administrator', action: 'delete', summary: 'Deleted 3 content items from BSIT 2-A.', at: isoDaysAgo(5, 8) },
  { id: 'log-7', actor: 'OMSU Administrator', action: 'settings', summary: 'Ran a manual backup.', at: isoDaysAgo(6, 2) },
  { id: 'log-8', actor: 'OMSU Administrator', action: 'delete', summary: 'Deleted the class "BEED 1-C".', at: isoDaysAgo(7, 16) },
  { id: 'log-9', actor: 'OMSU Administrator', action: 'security', summary: 'Revoked a session on Chrome · Windows.', at: isoDaysAgo(8, 9) },
  { id: 'log-10', actor: 'OMSU Administrator', action: 'create', summary: 'Scheduled announcement "Enrollment period".', at: isoDaysAgo(9, 14) },
  { id: 'log-11', actor: 'OMSU Administrator', action: 'update', summary: 'Re-enabled the AI quiz synthesizer.', at: isoDaysAgo(10, 10) },
  { id: 'log-12', actor: 'OMSU Administrator', action: 'settings', summary: 'Updated the academic term dates.', at: isoDaysAgo(12, 9) },
  { id: 'log-13', actor: 'OMSU Administrator', action: 'delete', summary: 'Deleted 2 user accounts.', at: isoDaysAgo(14, 11) },
  { id: 'log-14', actor: 'OMSU Administrator', action: 'settings', summary: 'Updated upload limits.', at: isoDaysAgo(16, 15) },
  { id: 'log-15', actor: 'OMSU Administrator', action: 'delete', summary: 'Deleted 1 announcement.', at: isoDaysAgo(19, 8) },
  { id: 'log-16', actor: 'OMSU Administrator', action: 'security', summary: 'Updated the security policy.', at: isoDaysAgo(22, 13) },
];

/** Active admin sessions — there is one admin account, but it can be signed in from several devices. */
export const mockSessions = [
  { id: 'sess-1', device: 'Windows PC', browser: 'Chrome 131', ip: '203.177.42.10', location: 'Mamburao, Occidental Mindoro', startedAt: isoDaysAgo(0, 8), lastActiveAt: isoDaysAgo(0, 8), current: true },
  { id: 'sess-2', device: 'iPhone', browser: 'Safari 18', ip: '110.54.128.77', location: 'San Jose, Occidental Mindoro', startedAt: isoDaysAgo(2, 19), lastActiveAt: isoDaysAgo(1, 7), current: false },
  { id: 'sess-3', device: 'MacBook', browser: 'Chrome 130', ip: '112.198.90.4', location: 'Manila, NCR', startedAt: isoDaysAgo(6, 21), lastActiveAt: isoDaysAgo(5, 12), current: false },
  { id: 'sess-4', device: 'Android phone', browser: 'Chrome Mobile 130', ip: '49.145.12.233', location: 'Mamburao, Occidental Mindoro', startedAt: isoDaysAgo(9, 10), lastActiveAt: isoDaysAgo(9, 10), current: false },
];

/** Seed history for /security/login-attempts; the mock backend appends a real row on every login call. */
export const mockLoginAttempts = [
  { id: 'att-1', identifier: 'admin@omsu.edu.ph', success: true, locked: false, ip: '203.177.42.10', at: isoDaysAgo(0, 8) },
  { id: 'att-2', identifier: 'admin@omsu.edu.ph', success: false, locked: false, ip: '58.69.201.14', at: isoDaysAgo(1, 22) },
  { id: 'att-3', identifier: 'admin@omsu.edu.ph', success: false, locked: false, ip: '58.69.201.14', at: isoDaysAgo(1, 22) },
  { id: 'att-4', identifier: 'admin', success: true, locked: false, ip: '110.54.128.77', at: isoDaysAgo(2, 7) },
  { id: 'att-5', identifier: 'administrator@omsu.edu.ph', success: false, locked: false, ip: '202.90.4.55', at: isoDaysAgo(4, 10) },
  { id: 'att-6', identifier: 'admin@omsu.edu.ph', success: false, locked: false, ip: '202.90.4.55', at: isoDaysAgo(4, 10) },
  { id: 'att-7', identifier: 'admin@omsu.edu.ph', success: false, locked: false, ip: '202.90.4.55', at: isoDaysAgo(4, 10) },
  { id: 'att-8', identifier: 'admin@omsu.edu.ph', success: false, locked: false, ip: '202.90.4.55', at: isoDaysAgo(4, 10) },
  { id: 'att-9', identifier: 'admin@omsu.edu.ph', success: false, locked: true, ip: '202.90.4.55', at: isoDaysAgo(4, 10) },
  { id: 'att-10', identifier: 'admin@omsu.edu.ph', success: true, locked: false, ip: '203.177.42.10', at: isoDaysAgo(5, 9) },
  { id: 'att-11', identifier: 'admin@omsu.edu.ph', success: true, locked: false, ip: '112.198.90.4', at: isoDaysAgo(6, 21) },
  { id: 'att-12', identifier: 'root', success: false, locked: false, ip: '41.223.9.88', at: isoDaysAgo(8, 3) },
  { id: 'att-13', identifier: 'admin@omsu.edu.ph', success: true, locked: false, ip: '49.145.12.233', at: isoDaysAgo(9, 10) },
  { id: 'att-14', identifier: 'admin@omsu.edu.ph', success: true, locked: false, ip: '203.177.42.10', at: isoDaysAgo(12, 8) },
];

/** Security posture checklist for /security/vulnerabilities — "scanner-style" findings, from the API once it exists. */
export const mockVulnerabilities = [
  { id: 'vuln-1', title: 'Dependencies are out of date', category: 'Dependencies', severity: 'Medium', description: 'One or more packages have a newer release with a security fix.', recommendation: 'Run `npm outdated` and upgrade flagged packages, then re-run `npm run build`.' },
  { id: 'vuln-2', title: 'Password policy meets the mobile standard', category: 'Password policy', severity: 'Low', description: 'The admin password must satisfy all five rules shared with studia-mobile (length, case, number, symbol).', recommendation: 'No action — re-check after any change to core/logic/validation.js.' },
  { id: 'vuln-3', title: 'OTP codes are 6 digits with a 5-minute expiry', category: 'OTP policy', severity: 'Low', description: 'Codes are single-use and rate-limited by the resend interval.', recommendation: 'Confirm the production backend hashes OTPs at rest and never logs the plain code.' },
  { id: 'vuln-4', title: 'Login rate limiting is active', category: 'Rate limiting', severity: 'Low', description: 'Failed admin logins lock the account for a cooldown period after too many attempts.', recommendation: 'Keep the lockout enforced server-side as well — a client-only counter is not a real control.' },
  { id: 'vuln-5', title: 'HTTPS is not yet enforced for the real API', category: 'Transport security', severity: 'High', description: 'No backend exists yet; once deployed, HTTP must redirect to HTTPS and use HSTS.', recommendation: 'Terminate TLS at the load balancer and send `Strict-Transport-Security`.' },
  { id: 'vuln-6', title: 'Content-Security-Policy is a meta tag only', category: 'CSP', severity: 'Medium', description: 'A `<meta http-equiv="Content-Security-Policy">` tag is set, but `frame-ancestors` is ignored in a meta tag.', recommendation: 'Send the same policy as a response header from the web server once this is deployed.' },
  { id: 'vuln-7', title: 'Last backup is recent', category: 'Backup age', severity: 'Low', description: 'The most recent backup completed within the expected window.', recommendation: 'Alert if a backup is more than 48 hours old.' },
  { id: 'vuln-8', title: 'Upload content-type is not sniffed server-side yet', category: 'File uploads', severity: 'High', description: 'There is no backend yet to verify an uploaded file’s real content type against its extension.', recommendation: 'Have the PHP API check magic bytes, not just the filename extension, before storing an upload.' },
];

/** Total matches mockStats.aiRequests, so the dashboard tile and this trend agree. */
export const mockAiRequestsTrend = [
  { month: 'Jun', count: 1120 },
  { month: 'Jul', count: 1380 },
  { month: 'Aug', count: 1540 },
  { month: 'Sep', count: 1890 },
  { month: 'Oct', count: 2080 },
  { month: 'Nov', count: 2340 },
];

export const mockAiFeatureHealth = [
  { feature: 'summarizer', label: 'Summarizer', avgLatencyMs: 1250, errorRatePct: 0.8 },
  { feature: 'planner', label: 'Study planner', avgLatencyMs: 640, errorRatePct: 0.3 },
  { feature: 'quizSynthesizer', label: 'Quiz synthesizer', avgLatencyMs: 2100, errorRatePct: 1.6 },
  { feature: 'chat', label: 'AI chat', avgLatencyMs: 820, errorRatePct: 0.5 },
];

export const mockAiQuota = {
  requestsUsed: 2340,
  requestsQuota: 5000,
  costEstimateUsd: 186.4,
  resetsOn: '2026-12-01',
};

/** Admin inbox: failed jobs, storage warnings and security alerts. */
export const mockNotifications = [
  { id: 'ntf-1', type: 'job', title: 'Video transcription failed', message: 'Lesson "Data Structures & Algorithms — Lesson 2" could not be transcribed after 3 attempts.', read: false, createdAt: isoDaysAgo(0, 8) },
  { id: 'ntf-2', type: 'storage', title: 'Storage at 82% capacity', message: 'Uploaded media is approaching the campus storage quota.', read: false, createdAt: isoDaysAgo(0, 6) },
  { id: 'ntf-3', type: 'security', title: 'Admin login from a new device', message: 'A sign-in to the admin portal was made from an unrecognized device.', read: false, createdAt: isoDaysAgo(1, 21) },
  { id: 'ntf-4', type: 'job', title: 'AI quiz generation failed', message: 'Quiz synthesis for BSIT 2-A timed out and was not published.', read: true, createdAt: isoDaysAgo(2, 10) },
  { id: 'ntf-5', type: 'storage', title: 'Nightly backup completed with warnings', message: 'The backup finished, but 2 large video files were skipped.', read: true, createdAt: isoDaysAgo(3, 2) },
  { id: 'ntf-6', type: 'security', title: '5 failed login attempts detected', message: 'Multiple failed admin sign-ins were blocked and temporarily locked out.', read: true, createdAt: isoDaysAgo(4, 9) },
  { id: 'ntf-7', type: 'job', title: 'Content processing queue backlog', message: 'The transcription queue is processing slower than usual.', read: true, createdAt: isoDaysAgo(5, 14) },
  { id: 'ntf-8', type: 'security', title: 'Password policy updated', message: 'The admin password policy was changed to require longer passwords.', read: true, createdAt: isoDaysAgo(6, 11) },
  { id: 'ntf-9', type: 'storage', title: 'Monthly AI quota at 90%', message: 'AI feature usage is nearing this month’s request quota.', read: true, createdAt: isoDaysAgo(8, 16) },
  { id: 'ntf-10', type: 'job', title: 'Scheduled maintenance completed', message: 'Planned maintenance finished with no downtime.', read: true, createdAt: isoDaysAgo(10, 3) },
];

/** New registrations by role, by month — feeds /reports' growth tab. */
export const mockUserGrowth = [
  { month: 'Jun', students: 52, instructors: 8 },
  { month: 'Jul', students: 96, instructors: 14 },
  { month: 'Aug', students: 74, instructors: 11 },
  { month: 'Sep', students: 122, instructors: 18 },
  { month: 'Oct', students: 104, instructors: 16 },
  { month: 'Nov', students: 150, instructors: 25 },
];

export const mockEngagementTrend = [
  { week: 'Wk 1', activeUsers: 640 },
  { week: 'Wk 2', activeUsers: 705 },
  { week: 'Wk 3', activeUsers: 690 },
  { week: 'Wk 4', activeUsers: 780 },
];

export const mockParticipationByCourse = [
  { label: 'BSIT', value: 78 },
  { label: 'BEED', value: 65 },
  { label: 'BSBA-FM', value: 71 },
  { label: 'BSBA-OM', value: 58 },
];

export const mockContentConsumption = [
  { label: 'Video', views: 5200, completionPct: 61 },
  { label: 'PDF', views: 3100, completionPct: 74 },
  { label: 'Slides', views: 2600, completionPct: 68 },
];

export const mockStrugglingConcepts = [
  { id: 'sc-1', concept: 'Database Normalization', course: 'BSIT', avgScorePct: 52, studentsAffected: 34 },
  { id: 'sc-2', concept: 'Recursion & Algorithm Complexity', course: 'BSIT', avgScorePct: 60, studentsAffected: 28 },
  { id: 'sc-3', concept: 'Financial Ratio Analysis', course: 'BSBA-FM', avgScorePct: 58, studentsAffected: 21 },
  { id: 'sc-4', concept: 'Classroom Assessment Design', course: 'BEED', avgScorePct: 61, studentsAffected: 19 },
  { id: 'sc-5', concept: 'Inventory & Supply Chain Models', course: 'BSBA-OM', avgScorePct: 55, studentsAffected: 17 },
];
