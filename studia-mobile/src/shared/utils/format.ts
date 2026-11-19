// format.ts — date, score and label formatting used by both roles.
// The student and instructor feature `logic/format.ts` files re-export from here and add only
// what is specific to their side, so there is one implementation of each helper.
import type { Tone } from "@/shared/constants/studia-colors";

/** OMSU passing mark (%). */
export const PASSING_PERCENT = 75;

/** PH locale everywhere: the app is for one campus and dates must not shift per device. */
const LOCALE = "en-PH";
const DATE_OPTS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

export function isOverdue(iso: string, now = Date.now()): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t < now;
}

/** "just now" / "12m ago" / "3h ago" / "2d ago". Empty string for an unparsable date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.floor(Math.max(0, now - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** "Due Nov 21, 5:00 PM" or "Overdue · was due …". */
export function dueLabel(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const when = `${date.toLocaleDateString(LOCALE, DATE_OPTS)}, ${date.toLocaleTimeString(LOCALE, TIME_OPTS)}`;
  return date.getTime() < now ? `Overdue · was due ${when}` : `Due ${when}`;
}

export function dayLabel(dayIso: string): string {
  return new Date(`${dayIso}T00:00:00`).toLocaleDateString(LOCALE, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function weekdayShort(dayIso: string): string {
  return new Date(`${dayIso}T00:00:00`).toLocaleDateString(LOCALE, { weekday: "short" });
}

/** 13 -> "1PM". */
export function hourLabel(hour: number): string {
  const h = ((hour + 11) % 12) + 1;
  return `${h}${hour >= 12 ? "PM" : "AM"}`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const toPercent = (score: number, max: number) =>
  max > 0 ? Math.round((score / max) * 100) : 0;

/** Green at or above passing, gold for a near miss, red below. */
export function scoreTone(percent: number): Tone {
  if (percent >= PASSING_PERCENT) return "green";
  if (percent >= 60) return "gold";
  return "red";
}
