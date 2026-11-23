// task-filters.ts — pure filtering/sorting for the To-do list (and the Home "today" bucket), so
// both screens agree on what "Today" means: due today OR already overdue and not done.
import { isOverdue } from "@/features/student/logic/format";
import type { Task } from "@/features/student/types/student";

export const TASK_TABS = ["Today", "Upcoming", "Overdue", "Done"] as const;
export type TaskTab = (typeof TASK_TABS)[number];

// G4: the sort / kind / class filter is gone. The four buckets are the only choice left and the
// order is always "soonest due first", which is what a to-do list is for.
export const isDueToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export function matchesTab(task: Task, tab: TaskTab): boolean {
  if (tab === "Done") return task.done;
  if (task.done) return false;
  if (tab === "Overdue") return isOverdue(task.dueAt);
  if (tab === "Today") return isDueToday(task.dueAt) || isOverdue(task.dueAt);
  return !isOverdue(task.dueAt) && !isDueToday(task.dueAt);
}

/** The tasks of one bucket, soonest due first. */
export function tasksForTab(tasks: Task[], tab: TaskTab): Task[] {
  return tasks.filter((t) => matchesTab(t, tab)).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
