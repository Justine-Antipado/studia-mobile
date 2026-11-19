// Exercises core/data/api.js against the in-memory mock backend: list shapes,
// filtering, sorting, paging, the detail records, the aggregates every page
// reads, and the writes (delete cascade, read counters, feature switches,
// audit trail). Run it with:
//
//   node scripts/check-api.mjs
//
// It touches nothing on disk and needs no server.
import fsSync from 'node:fs';
import { prepare, stubBrowser } from './_load.mjs';

stubBrowser();
const { load, cleanup } = prepare(['core']);
const api = await load('core/data/api.js');

let fail = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fail++; console.log('FAIL  ' + msg); } };
const list = (r, name) => {
  ok(Array.isArray(r?.data), name + ': no data array');
  ok(typeof r?.meta?.total === 'number', name + ': no meta.total');
  ok(typeof r?.meta?.page === 'number', name + ': no meta.page');
  ok(typeof r?.meta?.pageSize === 'number', name + ': no meta.pageSize');
  ok(r.data.length <= r.meta.pageSize, name + ': page longer than pageSize');
};

// --- auth ------------------------------------------------------------------
await api.login('admin', 'Studia@2026');
ok(true, 'login succeeded');
let rejected = false;
try {
  await api.login('admin', 'wrong-password');
} catch (e) {
  rejected = true;
  ok(!/incorrect password|no such account|unknown user/i.test(e.message),
    'login error names which half of the credentials was wrong: ' + e.message);
}
ok(rejected, 'a wrong password was accepted');
await api.login('admin', 'Studia@2026');

// --- lists -----------------------------------------------------------------
const users = await api.getUsers({ page: 1, pageSize: 10, sort: 'name', order: 'asc' });
list(users, 'getUsers');
ok(users.data.every((u) => ['Active', 'Inactive'].includes(u.status)),
  'getUsers: a status outside Active/Inactive came back - the pending/blocked flow leaked back in');
const names = users.data.map((u) => u.name);
ok(names.join('|') === [...names].sort((a, b) => a.localeCompare(b)).join('|'), 'getUsers: sort=name,asc is not applied');
const descPage = await api.getUsers({ page: 1, pageSize: 10, sort: 'name', order: 'desc' });
ok(descPage.data[0].name >= users.data[0].name, 'getUsers: order=desc is not applied');
const filtered = await api.getUsers({ page: 1, pageSize: 50, filters: { role: 'Student', course: 'BSIT' } });
ok(filtered.data.every((u) => u.role === 'Student' && u.course === 'BSIT'), 'getUsers: role/course filter not applied');
ok(filtered.meta.total <= users.meta.total, 'getUsers: filtering did not reduce the total');
const searched = await api.getUsers({ page: 1, pageSize: 50, q: users.data[0].name.split(' ')[0] });
ok(searched.data.length > 0, 'getUsers: search returned nothing for a name that exists');
const page2 = await api.getUsers({ page: 2, pageSize: 5 });
ok(page2.meta.page === 2, 'getUsers: page 2 did not come back as page 2');
ok(!page2.data.some((u) => u.id === users.data[0].id), 'getUsers: page 2 repeats a row from page 1');

for (const [name, fn] of [
  ['getClasses', api.getClasses], ['getContent', api.getContent], ['getAnnouncements', api.getAnnouncements],
  ['getNotifications', api.getNotifications], ['getAuditLog', api.getAuditLog], ['getLoginAttempts', api.getLoginAttempts],
]) list(await fn({ page: 1, pageSize: 10 }), name);

// --- detail records --------------------------------------------------------
const user = await api.getUser(users.data[0].id);
ok(user.id === users.data[0].id, 'getUser: wrong record');
ok(Array.isArray(user.classes) && Array.isArray(user.activity), 'getUser: classes/activity missing');
 ok(user.aiUsage !== undefined, 'getUser: aiUsage missing');
const classes = await api.getClasses({ page: 1, pageSize: 50 });
const cls = await api.getClass(classes.data[0].id);
for (const key of ['roster', 'materials', 'assignments', 'announcements']) {
  ok(Array.isArray(cls[key]), 'getClass: ' + key + ' missing');
}
ok(typeof cls.joinCode === 'string' && cls.joinCode.length > 0, 'getClass: no join code');

// --- aggregates ------------------------------------------------------------
const dash = await api.getDashboard();
for (const key of ['stats', 'registrations', 'roleDistribution', 'courseDistribution', 'aiUsage', 'systemHealth', 'activity']) {
  ok(dash[key] !== undefined, 'dashboard: ' + key + ' missing');
}
ok(dash.stats.totalUsers === dash.stats.students + dash.stats.instructors,
  'dashboard: totalUsers (' + dash.stats.totalUsers + ') != students + instructors (' + (dash.stats.students + dash.stats.instructors) + ')');
ok(dash.systemHealth.storageUsedPct >= 0 && dash.systemHealth.storageUsedPct <= 100, 'dashboard: storage % out of range');

const ai = await api.getAiHealth();
ok(ai.toggles && typeof ai.toggles === 'object', 'ai: toggles missing');
 ok(['summarizer','planner','quizSynthesizer','chat'].every((k) => typeof ai.toggles[k] === 'boolean'), 'ai: a feature switch is missing or not a boolean');
ok(ai.quota.requestsUsed <= ai.quota.requestsQuota, 'ai: usage above the quota');

const reports = await api.getReports();
for (const key of ['userGrowth', 'engagementTrend', 'participationByCourse', 'contentConsumption', 'strugglingConcepts']) {
  ok(Array.isArray(reports[key]) && reports[key].length > 0, 'reports: ' + key + ' empty');
}
const assessments = await api.getAssessments();
ok(assessments.stats.totalQuizzes === assessments.quizzes.length, 'assessments: quiz count does not match the list');

const findings = await api.getVulnerabilities();
const RANK = ['Critical', 'High', 'Medium', 'Low'];
const ranks = findings.map((f) => RANK.indexOf(f.severity));
ok(ranks.every((v) => v >= 0), 'vulnerabilities: unknown severity');
// The API returns findings unsorted; /security/vulnerabilities sorts them, so
// what matters is that every severity it returns has a rank on that page.
const pageSrc = fsSync.readFileSync('src/features/security/pages/Vulnerabilities.jsx', 'utf8');
ok(findings.every((f) => new RegExp(f.severity + ':').test(pageSrc)), 'vulnerabilities: a severity the API returns is missing from SEVERITY_ORDER, so it would sort as NaN');
ok(findings.every((f) => f.recommendation), 'vulnerabilities: a finding has no recommended fix');

const settings = await api.getSettings();
for (const key of ['term', 'email', 'securityPolicy', 'uploads', 'system', 'backup', 'legal', 'ai']) {
  ok(settings[key] !== undefined, 'settings: ' + key + ' section missing');
}

// --- writes ----------------------------------------------------------------
const before = await api.getUsers({ page: 1, pageSize: 1 });
await api.deleteUsers([before.data[0].id]);
const after = await api.getUsers({ page: 1, pageSize: 1 });
ok(after.meta.total === before.meta.total - 1, 'deleteUsers: the total did not drop');

// a deleted class must take its materials with it
const target = classes.data.find((c) => c.materialCount > 0) ?? classes.data[0];
const targetDetail = await api.getClass(target.id);
const contentBefore = await api.getContent({ page: 1, pageSize: 200 });
await api.deleteClasses([target.id]);
const contentAfter = await api.getContent({ page: 1, pageSize: 200 });
ok(contentAfter.meta.total === contentBefore.meta.total - targetDetail.materials.length,
  'deleteClasses: cascade is wrong - content total went ' + contentBefore.meta.total + ' -> ' + contentAfter.meta.total +
  ', the class had ' + targetDetail.materials.length + ' materials');

const notifs = await api.getNotifications({ page: 1, pageSize: 50 });
const unreadBefore = (await api.getNavCounts()).unreadNotifications;
const unreadRow = notifs.data.find((n) => !n.read);
if (unreadRow) {
  await api.markNotificationRead(unreadRow.id, true);
  ok((await api.getNavCounts()).unreadNotifications === unreadBefore - 1, 'markNotificationRead: the badge count did not drop');
}
await api.markAllNotificationsRead();
ok((await api.getNavCounts()).unreadNotifications === 0, 'markAllNotificationsRead: the badge count is not zero');

const summBefore = ai.toggles.summarizer;
await api.updateAiFeature('summarizer', !summBefore);
const aiAfter = await api.getAiHealth();
ok(aiAfter.toggles.summarizer === !summBefore, 'updateAiFeature: the switch did not stick');
const settingsAfter = await api.getSettings();
ok(settingsAfter.ai.summarizer === !summBefore, 'settings.ai does not mirror the switch set through /ai - two sources of truth');

// every write above should be in the audit log
const audit = await api.getAuditLog({ page: 1, pageSize: 50 });
ok(audit.data.length > 0, 'audit log is empty after several writes');
ok(audit.data.some((row) => /delete/i.test(row.action ?? '')), 'audit log has no entry for the deletes just performed');

console.log('');
console.log(checks + ' assertions over ' + Object.keys(api).filter((k) => typeof api[k] === 'function').length + ' api functions');
console.log(fail === 0 ? 'PASS  the mock backend behaves the way the pages assume' : fail + ' problem(s)');
cleanup();
process.exit(fail === 0 ? 0 : 1);
