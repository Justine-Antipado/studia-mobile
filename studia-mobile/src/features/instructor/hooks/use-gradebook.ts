// use-gradebook.ts — grade entries (assignments + quizzes) for one class or all of them.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useQuery } from "@/core/data/repository/use-query";
import { gradebookRepository } from "@/features/instructor/data/gradebook-repository";

export function useGradebook(classId: string | null) {
  return useQuery(cacheKey("instructor", "gradebook", classId ?? "all"), () => gradebookRepository.list(classId), {
    ttlMs: TTL.live,
  });
}
