// use-tasks.ts — the Home/To-do checklist. Toggle is optimistic (instant check mark, rolled
// back automatically if the repository call fails).
import { useCallback } from "react";

import { cacheKey } from "@/core/data/cache/cache-keys";
import { queryCache, TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { taskRepository } from "@/features/student/data/tasks-repository";
import type { Task } from "@/features/student/types/student";

const tasksKey = cacheKey("tasks");
const plannerKey = cacheKey("planner");

export function useTasks() {
  return useQuery(tasksKey, () => taskRepository.list(), { ttlMs: TTL.live });
}

export function useToggleTask() {
  const mutation = useMutation((id: string) => taskRepository.toggleDone(id), {
    optimistic: {
      key: tasksKey,
      apply: (id: string) => {
        const entry = queryCache.getEntry<Task[]>(tasksKey);
        if (!entry) return;
        queryCache.set(
          tasksKey,
          entry.data.map((t) => (t.id === id && !t.submitted ? { ...t, done: !t.done } : t)),
          TTL.live,
        );
      },
    },
    // Toggling a task also changes the auto-placed block it shows as in the Planner, which reads
    // its own "planner" cache entry independently of this one — invalidate both so the Planner
    // picks up the change too (as a background revalidation, not a blocking refetch).
    invalidate: () => [tasksKey, plannerKey],
  });

  const { run: runMutation } = mutation;
  // A task that is gone on the server (deleted, unpublished, class left) is only a stale cached
  // row: refresh both lists so it disappears, instead of failing on every tap.
  const run = useCallback(
    async (id: string) => {
      const result = await runMutation(id);
      if (!result.ok && result.error.code === "not_found") {
        queryCache.invalidate(tasksKey);
        queryCache.invalidate(plannerKey);
      }
      return result;
    },
    [runMutation],
  );

  return { ...mutation, run };
}
