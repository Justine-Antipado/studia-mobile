/**
 * Route paths. Import these instead of typing string literals, so a renamed
 * route is a one-line change here and in navigation.js.
 */
export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',

  users: '/users',
  userDetail: '/users/:id',

  classes: '/classes',
  classDetail: '/classes/:id',
  content: '/content',
  assessments: '/assessments',
  announcements: '/announcements',

  ai: '/ai',
  reports: '/reports',

  notifications: '/notifications',

  security: '/security',
  securityAuditLog: '/security/audit-log',
  securitySessions: '/security/sessions',
  securityLoginAttempts: '/security/login-attempts',
  securityVulnerabilities: '/security/vulnerabilities',

  settings: '/settings',
  settingsTerm: '/settings/term',
  settingsEmailOtp: '/settings/email-otp',
  settingsSecurityPolicy: '/settings/security-policy',
  settingsUploads: '/settings/uploads',
  settingsAi: '/settings/ai',
  settingsSystem: '/settings/system',
  settingsBackup: '/settings/backup',
  settingsLegal: '/settings/legal',
  settingsAccount: '/settings/account',

  help: '/help',
  forbidden: '/403',
};

/** Build a concrete path from a template: path(ROUTES.userDetail, { id: 7 }) */
export const path = (template, params = {}) =>
  template.replace(/:([A-Za-z0-9_]+)/g, (_, key) =>
    params[key] === undefined ? `:${key}` : encodeURIComponent(params[key])
  );
