// tasks-repository.ts — the student's auto-generated to-do, derived from every joined class's
// assignments and quizzes (never a separate hand-maintained list). A manual check-off is kept
// for items that are not yet backed by a real submission.
import { isRemote } from "@/core/config/data-source";
import { RemoteTaskRepository } from "@/features/student/data/tasks-remote";
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { assignmentRepository } from "@/features/student/data/assignments-repository";
import { classRepository } from "@/features/student/data/classes-repository";
import { quizRepository } from "@/features/student/data/quizzes-repository";
import type { Task } from "@/features/student/types/student";

export interface TaskRepository {
  list(): Promise<Result<Task[]>>;
  toggleDone(id: string): Promise<Result<Task>>;
}

const manualDone = new Set<string>();

class MockTaskRepository implements TaskRepository {
  async list(): Promise<Result<Task[]>> {
    const classesResult = await classRepository.list();
    if (!classesResult.ok) return classesResult;

    const tasks: Task[] = [];
    for (const cls of classesResult.value) {
      const [assignments, quizzes] = await Promise.all([
        assignmentRepository.listByClass(cls.id),
        quizRepository.listByClass(cls.id),
      ]);
      if (assignments.ok) {
        for (const a of assignments.value) {
          const derivedDone = a.status === "submitted" || a.status === "late" || a.status === "graded";
          tasks.push({
            id: `task_as_${a.id}`,
            kind: "assignment",
            classId: cls.id,
            classCode: cls.code,
            refId: a.id,
            title: a.title,
            dueAt: a.dueAt,
            done: derivedDone || manualDone.has(`task_as_${a.id}`),
          });
        }
      }
      if (quizzes.ok) {
        for (const q of quizzes.value) {
          if (!q.dueAt) continue;
          const id = `task_qz_${q.id}`;
          tasks.push({
            id,
            kind: "quiz",
            classId: cls.id,
            classCode: cls.code,
            refId: q.id,
            title: q.title,
            dueAt: q.dueAt,
            done: !!q.attempt || manualDone.has(id),
          });
        }
      }
    }
    return ok(tasks.sort((a, b) => a.dueAt.localeCompare(b.dueAt)));
  }

  async toggleDone(id: string): Promise<Result<Task>> {
    const all = await this.list();
    if (!all.ok) return all;
    const task = all.value.find((t) => t.id === id);
    if (!task) return fail(appError("not_found", "This task no longer exists."));

    const backedBySubmission =
      (task.kind === "assignment" && task.done && !manualDone.has(id)) ||
      (task.kind === "quiz" && task.done && !manualDone.has(id));
    if (backedBySubmission) {
      return fail(appError("conflict", "Already completed via submission.", false));
    }

    if (manualDone.has(id)) manualDone.delete(id);
    else manualDone.add(id);
    return ok({ ...task, done: !task.done });
  }
}

export const taskRepository: TaskRepository = isRemote ? new RemoteTaskRepository() : new MockTaskRepository();
