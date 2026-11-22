// tasks-repository.ts — the student's auto-generated to-do, derived by the database (student_tasks)
// from every joined class's assignments and quizzes. A manual check-off is kept for items that are
// not yet backed by a real submission.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteTaskRepository } from "@/features/student/data/tasks-remote";
import type { Task } from "@/features/student/types/student";

export interface TaskRepository {
  list(): Promise<Result<Task[]>>;
  toggleDone(id: string): Promise<Result<Task>>;
}

export const taskRepository: TaskRepository = new RemoteTaskRepository();
