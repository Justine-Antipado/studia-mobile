import type { Tone } from "@/shared/constants/studia-colors";

export const PASSING_PERCENT = 75;

export function newId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export const firstParam = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function timeAgo(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.floor(Math.max(0, now - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const toPercent = (score: number, max: number) =>
  max > 0 ? Math.round((score / max) * 100) : 0;

export function scoreTone(percent: number): Tone {
  if (percent >= PASSING_PERCENT) return "green";
  if (percent >= 60) return "gold";
  return "red";
}
