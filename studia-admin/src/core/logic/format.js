/** Display formatting. Everything the UI shows as a number or a date goes through here. */
const LOCALE = 'en-PH';

/** null, undefined and '' mean "no value" — Number() would turn them into 0. */
const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  return Number(value);
};

export const formatNumber = (n) => (Number.isFinite(toNumber(n)) ? toNumber(n).toLocaleString(LOCALE) : '—');

export const formatPercent = (value, digits = 0) =>
  Number.isFinite(toNumber(value)) ? `${toNumber(value).toFixed(digits)}%` : '—';

export function formatBytes(bytes) {
  const n = toNumber(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

const toDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function formatDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export function formatDateTime(value) {
  const d = toDate(value);
  return d
    ? d.toLocaleString(LOCALE, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 'just now' | '12 min ago' | 'Yesterday' | 'Nov 2, 2026' */
export function formatRelative(value, now = Date.now()) {
  const d = toDate(value);
  if (!d) return '—';
  const diff = now - d.getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} h ago`;
  if (diff < 2 * DAY) return 'Yesterday';
  if (diff < 7 * DAY) return `${Math.round(diff / DAY)} days ago`;
  return formatDate(d);
}

/** Seconds -> '1:05', used by resend timers. */
export function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${formatNumber(count)} ${Math.abs(Number(count)) === 1 ? singular : plural}`;

export const truncate = (text = '', max = 60) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

export const initials = (name = '') =>
  name
    .replace(/^Prof\.\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
