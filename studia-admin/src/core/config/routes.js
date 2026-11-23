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
  securityLoginAttempts: '/security/login-attempts',

  settings: '/settings',
  settingsAi: '/settings/ai',
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
