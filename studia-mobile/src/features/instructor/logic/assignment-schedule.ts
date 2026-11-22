// assignment-schedule.ts — due-date defaults, quick presets and validation for the assignment form.
// A due date is stored as a UTC ISO string; the picker works with a Date.

/** Tomorrow at 11:59 PM, local time. */
export function defaultDueDate(now = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(23, 59, 0, 0);
  return d;
}

export const DUE_PRESETS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
] as const;

/** `days` from today at 11:59 PM. */
export function presetDue(days: number, now = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d;
}

/**
 * A NEW assignment cannot be due in the past. When EDITING, any date is allowed so the instructor
 * can still extend a deadline that has already passed.
 */
export function validateDue(due: Date, mode: "create" | "edit", now = Date.now()): string | null {
  if (Number.isNaN(due.getTime())) return "Pick a due date.";
  if (mode === "create" && due.getTime() <= now) return "The due date must be in the future.";
  return null;
}
