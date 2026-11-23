import { matchesTab, tasksForTab } from "@/features/student/logic/task-filters";
import type { Task } from "@/features/student/types/student";

const HOUR = 3_600_000;
const task = (id: string, hoursFromNow: number, over: Partial<Task> = {}): Task => ({
  id,
  kind: "assignment",
  classId: "c1",
  classCode: "IT 1",
  refId: id,
  title: id,
  dueAt: new Date(Date.now() + hoursFromNow * HOUR).toISOString(),
  done: false,
  ...over,
});

describe("task tabs", () => {
  it("puts overdue items in Today AND Overdue (same rule on Home and To-do)", () => {
    const late = task("late", -30);
    expect(matchesTab(late, "Overdue")).toBe(true);
    expect(matchesTab(late, "Today")).toBe(true);
    expect(matchesTab(late, "Upcoming")).toBe(false);
  });

  it("moves finished work to Done only", () => {
    const done = task("d", 5, { done: true });
    expect(matchesTab(done, "Done")).toBe(true);
    expect(matchesTab(done, "Today")).toBe(false);
  });

  it("treats far-future work as Upcoming", () => {
    expect(matchesTab(task("f", 24 * 10), "Upcoming")).toBe(true);
  });
});

describe("tasksForTab", () => {
  const list = [task("b", 100), task("a", 50, { kind: "quiz", classId: "c2" }), task("c", 200)];

  it("keeps only the bucket's tasks, soonest due first", () => {
    expect(tasksForTab(list, "Upcoming").map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("excludes tasks of another bucket", () => {
    expect(tasksForTab(list, "Done")).toHaveLength(0);
  });
});
