/**
 * NAVIGATION — single source of truth for the sidebar, the breadcrumbs and the
 * document title of every page. Adding a tab means editing this file only.
 *
 * `icon` is a key of the `Icon` map in shared/components/ui.jsx (a string, so
 * this module stays plain data and can be imported anywhere).
 * `badge` is a key of the counts object the Layout passes to the Sidebar.
 */
import { ROUTES } from './routes';

export const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      {
        path: ROUTES.dashboard,
        label: 'Dashboard',
        icon: 'Home',
        title: 'Dashboard',
        description: 'Platform activity, users and AI usage at a glance.',
      },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      {
        path: ROUTES.users,
        label: 'Users',
        icon: 'Users',
        title: 'Users',
        description: 'Students and instructors registered in the mobile app.',
        children: [
          {
            path: ROUTES.userDetail,
            label: 'User profile',
            title: 'User profile',
            description: 'Profile, classes, activity and AI usage.',
          },
        ],
      },
    ],
  },
  {
    id: 'academics',
    label: 'Academics',
    items: [
      {
        path: ROUTES.classes,
        label: 'Classes',
        icon: 'Classes',
        title: 'Classes',
        description: 'Every class created by an instructor, read-only.',
        children: [
          {
            path: ROUTES.classDetail,
            label: 'Class detail',
            title: 'Class detail',
            description: 'Roster, materials, assignments and announcements.',
          },
        ],
      },
      {
        path: ROUTES.content,
        label: 'Content',
        icon: 'Content',
        title: 'Content library',
        description: 'Lesson videos, PDFs and slides with processing status.',
      },
      {
        path: ROUTES.assessments,
        label: 'Assessments',
        icon: 'Assessments',
        title: 'Assessments',
        description: 'Quizzes and assignments across the campus.',
      },
      {
        path: ROUTES.announcements,
        label: 'Announcements',
        icon: 'Megaphone',
        title: 'Announcements',
        description: 'Class stream posts, plus campus-wide notices sent to every Alerts tab.',
      },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      {
        path: ROUTES.ai,
        label: 'AI health',
        icon: 'Sparkle',
        title: 'AI health',
        description: 'Requests, queue, latency and failures per AI feature.',
      },
      {
        path: ROUTES.reports,
        label: 'Reports',
        icon: 'Chart',
        title: 'Reports',
        description: 'Engagement, consumption and growth, exportable.',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        path: ROUTES.notifications,
        label: 'Notifications',
        icon: 'Bell',
        title: 'Notifications',
        description: 'Failed jobs, storage warnings and security alerts.',
        badge: 'unreadNotifications',
      },
      {
        path: ROUTES.security,
        label: 'Security',
        icon: 'Shield',
        title: 'Security',
        description: 'Login overview, audit log and login attempts.',
      },
      {
        path: ROUTES.settings,
        label: 'Settings',
        icon: 'Settings',
        title: 'Settings',
        description: 'AI, system and maintenance, legal text and the admin account.',
      },
      {
        path: ROUTES.help,
        label: 'Help',
        icon: 'Help',
        title: 'Help',
        description: 'Short admin guide and about STUDIA.',
      },
    ],
  },
];

/** Pages that are reachable but never shown in the sidebar. */
const EXTRA_PAGES = [
  { path: ROUTES.forbidden, label: 'No access', title: 'No access', description: 'This account cannot open that page.' },
];

/** Flat list of every known page, parents before children. */
export const NAV_PAGES = (() => {
  const flat = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      flat.push({ ...item, groupId: group.id, groupLabel: group.label, parentPath: null });
      for (const child of item.children ?? []) {
        flat.push({ ...child, groupId: group.id, groupLabel: group.label, parentPath: item.path });
      }
    }
  }
  return [...flat, ...EXTRA_PAGES.map((p) => ({ ...p, groupId: null, groupLabel: null, parentPath: null }))];
})();

const toRegExp = (template) =>
  new RegExp('^' + template.replace(/:[A-Za-z0-9_]+/g, '([^/]+)').replace(/\//g, '\\/') + '$');

/** The page whose template matches this pathname, or null. Static paths win over params. */
export function findPage(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const exact = NAV_PAGES.find((p) => p.path === clean);
  if (exact) return exact;
  return NAV_PAGES.find((p) => p.path.includes(':') && toRegExp(p.path).test(clean)) ?? null;
}

/** Breadcrumb trail for a pathname: [{ label, to }]; the last item has no `to`. */
export function breadcrumbsFor(pathname) {
  const page = findPage(pathname);
  if (!page) return [];
  const trail = [];
  let current = page;
  const seen = new Set();
  while (current && !seen.has(current.path)) {
    seen.add(current.path);
    trail.unshift(current);
    const parent = current.parentPath;
    current = parent ? NAV_PAGES.find((p) => p.path === parent) : null;
  }
  return trail.map((item, i) => ({
    label: item.label,
    to: i === trail.length - 1 ? null : item.path,
  }));
}

/** "Users · STUDIA Admin" */
export const titleFor = (pathname, appName) => {
  const page = findPage(pathname);
  return page ? `${page.title} · ${appName}` : appName;
};

export const descriptionFor = (pathname) => findPage(pathname)?.description ?? '';

/** A page's own children, in order — used by hub pages (Settings, Security) to render their card grid without repeating labels/descriptions/icons a second time. */
export const childrenFor = (path) => NAV_PAGES.filter((p) => p.parentPath === path);

/** Top-level sidebar item that owns this pathname, used for the active state. */
export const activeItemFor = (pathname) => {
  const page = findPage(pathname);
  if (!page) return null;
  return page.parentPath ?? page.path;
};
