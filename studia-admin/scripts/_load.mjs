// Lets plain Node import the app's own source modules, with no bundler and no
// extra dependency.
//
// Two things stop `node` from importing src/core/**/*.js directly:
//   1. the imports are extensionless ("./routes"), which Vite resolves and
//      Node's ESM loader does not;
//   2. env.js reads `import.meta.env`, which only exists inside Vite.
//
// So the files are copied to a throwaway directory with those two things
// rewritten. Nothing under src/ is touched.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_ENV = {
  VITE_API_URL: 'http://localhost/api',
  VITE_APP_NAME: 'STUDIA Admin',
  VITE_SESSION_IDLE_MINUTES: '20',
};

const rewrite = (code, env) =>
  code
    // "./foo" / "../foo/bar" -> add the extension Node insists on
    .replace(/(from\s+['"])(\.[^'"]*?)(['"])/g, (m, head, spec, tail) =>
      /\.(js|mjs|json|css)$/.test(spec) ? m : `${head}${spec}.js${tail}`
    )
    .replace(/import\.meta\.env/g, JSON.stringify(env));

const copyTree = (from, to, env) => {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dest, env);
    else if (entry.name.endsWith('.js')) fs.writeFileSync(dest, rewrite(fs.readFileSync(src, 'utf8'), env));
  }
};

/**
 * Copy `src/<dirs>` into a temp directory and return a function that imports a
 * module from it: `const api = await load('core/data/api.js')`.
 */
export function prepare(dirs = ['core', 'shared'], env = DEFAULT_ENV) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-admin-check-'));
  for (const dir of dirs) copyTree(path.join('src', dir), path.join(root, dir), env);
  return {
    root,
    load: (rel) => import('file:///' + path.join(root, rel).replace(/\\/g, '/')),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

/** The browser globals the token store and theme touch at import time. */
export function stubBrowser() {
  globalThis.localStorage = {
    _v: {},
    getItem(k) { return this._v[k] ?? null; },
    setItem(k, v) { this._v[k] = String(v); },
    removeItem(k) { delete this._v[k]; },
  };
  globalThis.window = { addEventListener() {}, removeEventListener() {}, location: { href: '/', pathname: '/' } };
  globalThis.document = { documentElement: { style: { setProperty() {} } }, head: { querySelector: () => null } };
}
