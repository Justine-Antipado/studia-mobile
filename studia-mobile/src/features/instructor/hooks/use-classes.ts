// use-classes.ts — screens only talk to these hooks, never to classes-repository directly.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { instructorClassRepository } from "@/features/instructor/data/classes-repository";

const classesKey = cacheKey("instructor", "classes");

export function useInstructorClasses() {
  return useQuery(classesKey, () => instructorClassRepository.list(), { ttlMs: TTL.static });
}

export function useInstructorClass(id: string | null) {
  return useQuery(id ? cacheKey("instructor", "classes", id) : null, () => instructorClassRepository.get(id!), {
    ttlMs: TTL.static,
    enabled: !!id,
  });
}

export function useCreateClass() {
  return useMutation(
    (input: { title: string; section: string; code: string }) => instructorClassRepository.create(input),
    { invalidate: () => classesKey },
  );
}

export function useArchiveClass(id: string) {
  return useMutation((archived: boolean) => instructorClassRepository.archive(id, archived), {
    invalidate: () => [classesKey, cacheKey("instructor", "classes", id)],
  });
}

export function useDeleteClass() {
  return useMutation((id: string) => instructorClassRepository.remove(id), {
    invalidate: (id) => [classesKey, cacheKey("instructor", "classes", id)],
  });
}
