// use-tasks.ts — the Home/To-do checklist. Toggle is optimistic (instant check mark, rolled
// back automatically if the repository call fails).
import { cacheKey } from "@/core/data/cache/cache-keys";
import { queryCache, TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { taskRepository } from "@/features/student/data/tasks-repository";
import type { Task } from "@/features/student/types/student";

const tasksKey = cacheKey("tasks");

export function useTasks() {
  return useQuery(tasksKey, () => taskRepository.list(), { ttlMs: TTL.live });
}

export function useToggleTask() {
  return useMutation((id: string) => taskRepository.toggleDone(id), {
    optimistic: {
      key: tasksKey,
      apply: (id: string) => {
        const entry = queryCache.getEntry<Task[]>(tasksKey);
        if (!entry) return;
        queryCache.set(
          tasksKey,
          entry.data.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
          TTL.live,
        );
      },
    },
    invalidate: () => tasksKey,
  });
}
