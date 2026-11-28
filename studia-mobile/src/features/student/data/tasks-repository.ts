// tasks-repository.ts — the student's auto-generated to-do, derived by the database (student_tasks)
// from every joined class's assignments and quizzes. Read-only: a task is done only by submitting it.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteTaskRepository } from "@/features/student/data/tasks-remote";
import type { Task } from "@/features/student/types/student";

export interface TaskRepository {
  list(): Promise<Result<Task[]>>;
}

export const taskRepository: TaskRepository = new RemoteTaskRepository();
