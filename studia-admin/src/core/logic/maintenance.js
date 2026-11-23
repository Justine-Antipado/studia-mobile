/**
 * MAINTENANCE — the one description of what is switched off, for whom.
 *
 * The admin writes this document in Settings → System; it is stored under
 * `settings.system.maintenance` and sent to the API as-is:
 *
 *   {
 *     enabled:  boolean,
 *     scope:    'all' | 'roles' | 'features',
 *     roles:    ['student', 'instructor'],   // scope 'roles'
 *     features: ['classes', 'ai.chat', …],   // scope 'features'
 *     message:  string,                      // shown to affected users
 *     startsAt: '' | ISO-ish local string,   // '' = right now
 *     endsAt:   '' | ISO-ish local string,   // '' = until turned off
 *   }
 *
 * `isUnderMaintenance(config, user, feature)` is the only gate the student and
 * instructor apps (and the API middleware) need: it answers one question for
 * one request, so the same rule runs on both sides of the wire.
 *
 * An admin is never locked out — the whole point is that they can turn it off.
 */

export const MAINTENANCE_SCOPES = [
  {
    value: 'all',
    label: 'Entire system',
    hint: 'Blocks all student and instructor access. Admins can still log in.',
  },
  { value: 'roles', label: 'By role', hint: 'Only the roles you pick are blocked.' },
  { value: 'features', label: 'Specific features', hint: 'Everything else keeps working.' },
];

export const MAINTENANCE_ROLES = [
  { value: 'student', label: 'Students' },
  { value: 'instructor', label: 'Instructors' },
];

/** The modules a feature-scoped window can cover. `id` is what gets stored. */
export const MAINTENANCE_FEATURES = [
  { id: 'classes', label: 'Classes' },
  { id: 'content', label: 'Content' },
  { id: 'assessments', label: 'Assessments' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'ai.summarizer', label: 'AI · Summarizer' },
  { id: 'ai.planner', label: 'AI · Planner' },
  { id: 'ai.quiz', label: 'AI · Quiz synthesis' },
  { id: 'ai.chat', label: 'AI · Chat' },
  { id: 'reports', label: 'Reports' },
  { id: 'notifications', label: 'Notifications' },
];

const FEATURE_LABELS = new Map(MAINTENANCE_FEATURES.map((f) => [f.id, f.label]));
const ROLE_LABELS = new Map(MAINTENANCE_ROLES.map((r) => [r.value, r.label]));

export const EMPTY_MAINTENANCE = Object.freeze({
  enabled: false,
  scope: 'all',
  roles: [],
  features: [],
  message: '',
  startsAt: '',
  endsAt: '',
});

/** Accepts the old boolean `maintenanceMode` too, so a stored document from before this change still reads. */
export function normalizeMaintenance(raw, legacyFlag = false) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const scope = ['all', 'roles', 'features'].includes(value.scope) ? value.scope : 'all';
  return {
    ...EMPTY_MAINTENANCE,
    ...value,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : !!legacyFlag,
    scope,
    roles: Array.isArray(value.roles) ? value.roles.filter((r) => ROLE_LABELS.has(r)) : [],
    features: Array.isArray(value.features) ? value.features.filter((f) => FEATURE_LABELS.has(f)) : [],
    message: typeof value.message === 'string' ? value.message : '',
    startsAt: typeof value.startsAt === 'string' ? value.startsAt : '',
    endsAt: typeof value.endsAt === 'string' ? value.endsAt : '',
  };
}

const atMs = (value) => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
};

/** Is the window live right now (enabled, started, not finished)? */
export function isMaintenanceWindowOpen(config, now = Date.now()) {
  const m = normalizeMaintenance(config);
  if (!m.enabled) return false;
  const starts = atMs(m.startsAt);
  const ends = atMs(m.endsAt);
  if (starts !== null && now < starts) return false;
  if (ends !== null && now >= ends) return false;
  return true;
}

/**
 * The gate. `user` is `{ role }` (or null for a signed-out caller, treated as a
 * student-facing request); `feature` is one of MAINTENANCE_FEATURES' ids, or
 * omitted to ask "is this role locked out of the app altogether?".
 */
export function isUnderMaintenance(config, user, feature, now = Date.now()) {
  if (!isMaintenanceWindowOpen(config, now)) return false;

  const role = user?.role ?? 'student';
  // Admins keep access, otherwise nobody could switch maintenance off again.
  if (role === 'admin') return false;

  const m = normalizeMaintenance(config);
  if (m.scope === 'all') return true;
  if (m.scope === 'roles') return m.roles.includes(role);
  // Feature scope: only the named modules are closed, for everyone but admins.
  return !!feature && m.features.includes(feature);
}

const list = (items) => {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

/** One sentence for the Save confirmation, e.g. "Students won't be able to access Assessments and AI · Chat." */
export function describeMaintenance(config) {
  const m = normalizeMaintenance(config);
  if (!m.enabled) return 'Maintenance is off. Students and instructors have full access.';

  if (m.scope === 'all') {
    return "No student or instructor will be able to use the app. Admins can still sign in.";
  }

  if (m.scope === 'roles') {
    if (m.roles.length === 0) return 'Pick at least one role, or nobody is affected.';
    return `${list(m.roles.map((r) => ROLE_LABELS.get(r) ?? r))} won't be able to use the app.`;
  }

  if (m.features.length === 0) return 'Pick at least one feature, or nobody is affected.';
  const names = list(m.features.map((f) => FEATURE_LABELS.get(f) ?? f));
  return `Students and instructors won't be able to access ${names}.`;
}

/** The short form for the top-bar banner, e.g. "Students · AI features". */
export function maintenanceBannerLabel(config) {
  const m = normalizeMaintenance(config);
  if (m.scope === 'all') return 'Entire system';
  if (m.scope === 'roles') {
    return m.roles.map((r) => ROLE_LABELS.get(r) ?? r).join(' · ') || 'No role selected';
  }
  const labels = m.features.map((f) => FEATURE_LABELS.get(f) ?? f);
  if (labels.length <= 2) return labels.join(' · ') || 'No feature selected';
  return `${labels.slice(0, 2).join(' · ')} +${labels.length - 2} more`;
}

/** True when the document is coherent enough to save. */
export function isMaintenanceValid(config) {
  const m = normalizeMaintenance(config);
  if (!m.enabled) return true;
  if (m.scope === 'roles' && m.roles.length === 0) return false;
  if (m.scope === 'features' && m.features.length === 0) return false;
  const starts = atMs(m.startsAt);
  const ends = atMs(m.endsAt);
  if (starts !== null && ends !== null && ends <= starts) return false;
  return true;
}
