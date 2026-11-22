// use-lessons.ts — lesson/material list + detail (transcript, AI summary).
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { lessonRepository } from "@/features/student/data/lessons-repository";

export function useLessons(classId: string | null) {
  return useQuery(classId ? cacheKey("lessons", classId) : null, () => lessonRepository.listByClass(classId!), {
    ttlMs: TTL.static,
    enabled: !!classId,
  });
}

export function useLesson(classId: string | null, id: string | null) {
  return useQuery(
    classId && id ? cacheKey("lesson", classId, id) : null,
    () => lessonRepository.get(classId!, id!),
    { ttlMs: TTL.ai, enabled: !!classId && !!id },
  );
}

/** Re-runs the AI summary (capped per lesson on the server; the error says when the cap is hit). */
export function useRegenerateSummary(classId: string, id: string) {
  return useMutation(() => lessonRepository.regenerateSummary(classId, id), {
    invalidate: () => [cacheKey("lesson", classId, id), cacheKey("lessons", classId)],
  });
}
