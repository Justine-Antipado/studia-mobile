// task-filters.ts — pure filtering/sorting for the To-do list (and the Home "today" bucket), so
// both screens agree on what "Today" means: due today OR already overdue and not done.
import { isOverdue } from "@/features/student/logic/format";
import type { Task } from "@/features/student/types/student";

export const TASK_TABS = ["Today", "Upcoming", "Overdue", "Done"] as const;
export type TaskTab = (typeof TASK_TABS)[number];

export type TaskSort = "soonest" | "latest";
export type TaskKindFilter = "all" | "assignment" | "quiz";

export type TaskFilter = {
  sort: TaskSort;
  kind: TaskKindFilter;
  /** "all" or a classId */
  classId: string;
};

export const DEFAULT_TASK_FILTER: TaskFilter = { sort: "soonest", kind: "all", classId: "all" };

export const isDueToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export function matchesTab(task: Task, tab: TaskTab): boolean {
  if (tab === "Done") return task.done;
  if (task.done) return false;
  if (tab === "Overdue") return isOverdue(task.dueAt);
  if (tab === "Today") return isDueToday(task.dueAt) || isOverdue(task.dueAt);
  return !isOverdue(task.dueAt) && !isDueToday(task.dueAt);
}

export function applyTaskFilter(tasks: Task[], tab: TaskTab, f: TaskFilter): Task[] {
  return tasks
    .filter(
      (t) =>
        matchesTab(t, tab) &&
        (f.kind === "all" || t.kind === f.kind) &&
        (f.classId === "all" || t.classId === f.classId),
    )
    .sort((a, b) => (f.sort === "latest" ? b.dueAt.localeCompare(a.dueAt) : a.dueAt.localeCompare(b.dueAt)));
}

export const isFilterActive = (f: TaskFilter) =>
  f.sort !== DEFAULT_TASK_FILTER.sort || f.kind !== "all" || f.classId !== "all";
