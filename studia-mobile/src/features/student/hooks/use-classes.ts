// use-classes.ts — screens only talk to these hooks, never to classes-repository directly.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { classRepository } from "@/features/student/data/classes-repository";

const classesKey = cacheKey("classes");

export function useClasses() {
  return useQuery(classesKey, () => classRepository.list(), { ttlMs: TTL.static });
}

export function useClass(id: string | null) {
  return useQuery(id ? cacheKey("classes", id) : null, () => classRepository.get(id!), {
    ttlMs: TTL.static,
    enabled: !!id,
  });
}

export function useJoinClass() {
  return useMutation((code: string) => classRepository.joinByCode(code), {
    invalidate: () => classesKey,
  });
}

export function useLeaveClass() {
  return useMutation((id: string) => classRepository.leave(id), {
    invalidate: (id) => [classesKey, cacheKey("classes", id)],
  });
}

export function useClassmates(id: string) {
  return useQuery(cacheKey("classes", id, "classmates"), () => classRepository.classmates(id), { ttlMs: TTL.static });
}
