// use-tasks.ts — the Home/To-do checklist. Read-only: a task is checked only by submitting it.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useQuery } from "@/core/data/repository/use-query";
import { taskRepository } from "@/features/student/data/tasks-repository";

const tasksKey = cacheKey("tasks");

export function useTasks() {
  return useQuery(tasksKey, () => taskRepository.list(), { ttlMs: TTL.live });
}
