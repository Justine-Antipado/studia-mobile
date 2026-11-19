/**
 * TOKEN STORE — the only module that holds the access token.
 *
 * Decision (documented in docs/api-contract.md): the token lives in memory, and
 * only a short "session marker" is mirrored to localStorage so that a page
 * reload and other tabs know a session exists. When the PHP backend can set an
 * httpOnly, SameSite=Strict cookie, drop the mirror entirely and switch
 * client.js to `credentials: 'include'`: nothing else in the app changes.
 *
 * The marker also gives us multi-tab logout sync for free: clearing it in one
 * tab fires a `storage` event in the others.
 */
const MARKER_KEY = 'studia_admin_session';

let accessToken = null;
let refreshHandler = null;
const listeners = new Set();

const safeRead = () => {
  try {
    const raw = localStorage.getItem(MARKER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const safeWrite = (value) => {
  try {
    if (value === null) localStorage.removeItem(MARKER_KEY);
    else localStorage.setItem(MARKER_KEY, JSON.stringify(value));
  } catch {
    /* private mode / quota — the in-memory token still works for this tab */
  }
};

const emit = () => listeners.forEach((fn) => fn(getSession()));

export const getToken = () => accessToken;

/** The persisted part of the session: { admin, hasToken } or null. */
export const getSession = () => safeRead();

export function setSession({ token, admin }) {
  accessToken = token ?? null;
  safeWrite({ admin, hasToken: !!token, at: Date.now() });
  emit();
}

export function clearSession() {
  accessToken = null;
  safeWrite(null);
  emit();
}

/** Subscribe to session changes in this tab and in other tabs. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== MARKER_KEY) return;
    // Another tab logged in or out. Drop our in-memory token when it logged out.
    if (e.newValue === null) accessToken = null;
    emit();
  });
}

/**
 * Register the "refresh the access token" strategy. client.js calls this once
 * on a 401 before giving up. Until the backend exposes a refresh endpoint this
 * stays unset and a 401 simply ends the session.
 */
export const setRefreshHandler = (fn) => {
  refreshHandler = fn;
};

export const refreshToken = async () => {
  if (!refreshHandler) return false;
  try {
    const token = await refreshHandler();
    if (!token) return false;
    accessToken = token;
    const current = safeRead();
    safeWrite({ ...(current ?? {}), hasToken: true, at: Date.now() });
    return true;
  } catch {
    return false;
  }
};
