/**
 * Environment — the ONLY place import.meta.env is read.
 *
 * Vite inlines import.meta.env.* at build time, so every flag has a literal
 * fallback here. Keep the list in sync with ../../.env.example.
 */
const raw = import.meta.env;

const str = (value, fallback) => {
  const v = typeof value === 'string' ? value.trim() : '';
  return v || fallback;
};

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const env = {
  /** Base URL of the PHP API, e.g. https://studia.omsu.edu.ph. Empty = same origin. */
  apiUrl: str(raw.VITE_API_URL, ''),
  supabaseUrl: str(raw.VITE_SUPABASE_URL, ''),
  supabaseAnonKey: str(raw.VITE_SUPABASE_ANON_KEY, ''),
  appName: str(raw.VITE_APP_NAME, 'STUDIA Admin'),
  /** Default "from" address for OTP and notification mail. The SMTP credentials
   *  behind it belong in the server's .env only — never in this bundle. */
  mailFrom: str(raw.VITE_MAIL_FROM, 'studia.noreply2026@gmail.com'),
  sessionIdleMinutes: int(raw.VITE_SESSION_IDLE_MINUTES, 20),
  isDev: !!raw.DEV,
};

export const { appName: APP_NAME } = env;
