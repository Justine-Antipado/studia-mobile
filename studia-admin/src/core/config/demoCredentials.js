/**
 * DEMO CREDENTIALS — delete this file before going to production.
 *
 * This is the ONLY place in the app where a credential is written down. It is
 * read through core/config/demo.js, which loads it with import.meta.glob, so
 * deleting this file still leaves the app compiling and building; the login
 * page simply stops showing the demo box.
 *
 * It is also only ever read when VITE_USE_MOCK=true, i.e. while the UI runs on
 * the in-memory mock backend. The real backend holds the real admin account.
 */
export const demoCredentials = {
  label: 'Demo credentials (mock backend only)',
  identifier: 'admin@omsu.edu.ph',
  altIdentifier: 'admin',
  password: 'Studia@2026',
};

export default demoCredentials;
