/**
 * Accessor for the (removable) demo credentials file.
 *
 * import.meta.glob resolves at build time and yields an empty object when the
 * file is gone, so `rm src/core/config/demoCredentials.js` never breaks the
 * build — unlike a static or dynamic import of a missing module.
 *
 * The comparison below is against the raw import.meta.env value on purpose:
 * Vite inlines it as a literal, so in a build with VITE_USE_MOCK=false the
 * whole branch is dead code and the credentials file is dropped from the
 * bundle instead of merely being hidden. (Deleting the file is still the real
 * production step — see docs/admin-progress.md.)
 */
const modules =
  import.meta.env.VITE_USE_MOCK !== 'false' ? import.meta.glob('./demoCredentials.js', { eager: true }) : {};

/** The demo credentials, or null when the file was deleted or mocks are off. */
export function getDemoCredentials() {
  const mod = modules['./demoCredentials.js'];
  return mod?.demoCredentials ?? mod?.default ?? null;
}
