// Every route the portal mounts must have a title, a meta description and a
// breadcrumb trail, and navigation.js must stay in step with routes.js and
// App.jsx. Run it with:
//
//   node scripts/check-routes.mjs
import fs from 'node:fs';
import { prepare } from './_load.mjs';

const { load, cleanup } = prepare(['core']);
const { NAV_PAGES, titleFor, descriptionFor, findPage, breadcrumbsFor } = await load('core/config/navigation.js');
const { ROUTES } = await load('core/config/routes.js');

const appSrc = fs.readFileSync('src/App.jsx', 'utf8');
const APP = 'STUDIA Admin';

// Pages that live outside <Layout>, so they set their own document title.
const SELF_TITLED = {
  '/login': 'src/features/auth/pages/Login.jsx',
  '/403': 'src/features/errors/pages/Forbidden.jsx',
};

let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.log('FAIL  ' + msg); } };

for (const [name, p] of Object.entries(ROUTES)) {
  if (SELF_TITLED[p]) {
    ok(fs.readFileSync(SELF_TITLED[p], 'utf8').includes('useDocumentTitle'),
      `${p} (${name}) must set its own document title`);
    continue;
  }
  const sample = p.replace(/:\w+/g, '42');
  const page = findPage(sample);
  ok(!!page, `${name} (${p}) has no entry in navigation.js`);
  if (!page) continue;
  ok(!!page.title, `${p} has no title`);
  ok(!!page.description, `${p} has no meta description`);
  ok(titleFor(sample, APP).endsWith(' · ' + APP), `${p} title is not suffixed with the app name`);
  ok(descriptionFor(sample).length >= 20, `${p} description is too short to be useful`);
  ok(descriptionFor(sample).length <= 160, `${p} description is longer than 160 characters`);
  ok(breadcrumbsFor(sample).length >= 1, `${p} has no breadcrumb trail`);
}

for (const m of appSrc.matchAll(/path=\{ROUTES\.(\w+)\}/g)) {
  ok(ROUTES[m[1]] !== undefined, `App.jsx uses ROUTES.${m[1]}, which routes.js does not define`);
}
for (const name of Object.keys(ROUTES)) {
  ok(appSrc.includes(`ROUTES.${name}`), `ROUTES.${name} is never mounted in App.jsx`);
}

const titles = NAV_PAGES.map((p) => p.title);
ok(new Set(titles).size === titles.length,
  'two pages share a document title: ' + titles.filter((t, i) => titles.indexOf(t) !== i).join(', '));
ok(fs.readFileSync('src/features/errors/pages/NotFound.jsx', 'utf8').includes('useDocumentTitle'),
  'the 404 page sets no document title');

console.log(fail === 0
  ? `PASS  ${Object.keys(ROUTES).length} routes: titled, described, breadcrumbed and mounted`
  : `${fail} problem(s)`);
cleanup();
process.exit(fail === 0 ? 0 : 1);
