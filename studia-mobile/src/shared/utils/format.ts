// format.ts — date, score and label formatting used by both roles.
// The student and instructor feature `logic/format.ts` files re-export from here and add only
// what is specific to their side, so there is one implementation of each helper.
import type { Tone } from "@/shared/constants/studia-colors";

/** OMSU passing mark (%). */
export const PASSING_PERCENT = 75;

/** PH locale everywhere: the app is for one campus and dates must not shift per device. */
export const LOCALE = "en-PH";
/** Pinned so a due date reads the same on every device (a phone set to another zone must not shift it). */
export const TIME_ZONE = "Asia/Manila";
const DATE_OPTS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: TIME_ZONE };
const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE };

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

/** One-line detail for a lesson/material row: duration, else file size, else the link host. */
export function materialDetail(m: {
  durationLabel: string | null;
  attachment: { sizeLabel: string } | null;
  link: { url: string } | null;
}): string {
  if (m.durationLabel) return m.durationLabel;
  if (m.attachment) return m.attachment.sizeLabel;
  if (m.link) {
    try {
      return new URL(m.link.url).hostname.replace(/^www\./, "");
    } catch {
      return "Video link";
    }
  }
  return "";
}

/** "YYYY-MM-DD" in the device's LOCAL calendar. toISOString() is UTC, which shifts the day by one
 *  in the Philippines (UTC+8) for anything before 8 AM. */
export function toLocalIso(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Adds whole calendar days to a local "YYYY-MM-DD". */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalIso(d);
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

/** Compact day-chip label: "Sun 15". */
export function dayChipLabel(dayIso: string): string {
  return `${weekdayShort(dayIso)} ${new Date(`${dayIso}T00:00:00`).getDate()}`;
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
