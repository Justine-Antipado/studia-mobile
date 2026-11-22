// quiz-schedule.ts — defaults and validation for a quiz's due date, late window and time limit.
import { defaultDueDate } from "@/features/instructor/logic/assignment-schedule";
import type { QuizSchedule } from "@/features/instructor/types/instructor";

export const MAX_TIME_LIMIT_MIN = 300;

export function defaultSchedule(now = new Date()): QuizSchedule {
  return { dueAt: defaultDueDate(now).toISOString(), allowLate: false, closesAt: null, timeLimitMin: null };
}

/** Closing time to suggest when the instructor switches late attempts on: 2 days after the due date. */
export function suggestedClose(due: Date): Date {
  const d = new Date(due);
  d.setDate(d.getDate() + 2);
  return d;
}

export function parseTimeLimit(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: true, value: null };
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1) return { ok: false, error: "Time limit must be a whole number of minutes." };
  if (n > MAX_TIME_LIMIT_MIN) return { ok: false, error: `Keep the time limit at ${MAX_TIME_LIMIT_MIN} minutes or less.` };
  return { ok: true, value: n };
}

/** Returns an error message or null. `mode` "create" refuses a due date in the past. */
export function validateSchedule(s: QuizSchedule, mode: "create" | "edit", now = Date.now()): string | null {
  if (!s.dueAt) return "Pick a due date.";
  const due = new Date(s.dueAt).getTime();
  if (Number.isNaN(due)) return "Pick a due date.";
  if (mode === "create" && due <= now) return "The due date must be in the future.";
  if (s.allowLate) {
    if (!s.closesAt) return "Pick when the quiz stops accepting late attempts.";
    if (new Date(s.closesAt).getTime() <= due) return "The closing time must be after the due date.";
  }
  return null;
}
