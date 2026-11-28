// use-assignments.ts — assignment detail + submission. Writes invalidate the to-do list and the
// planner too, since both derive their tasks from assignment status.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { assignmentRepository } from "@/features/student/data/assignments-repository";
import type { Attachment } from "@/features/student/types/student";

export function useAssignments(classId: string | null) {
  return useQuery(
    classId ? cacheKey("assignments", classId) : null,
    () => assignmentRepository.listByClass(classId!),
    { ttlMs: TTL.live, enabled: !!classId },
  );
}

export function useAssignment(classId: string | null, id: string | null) {
  return useQuery(
    classId && id ? cacheKey("assignment", classId, id) : null,
    () => assignmentRepository.get(classId!, id!),
    { ttlMs: TTL.live, enabled: !!classId && !!id },
  );
}

const invalidateAssignment = (classId: string, id: string) => [
  cacheKey("assignment", classId, id),
  cacheKey("assignments", classId),
  cacheKey("tasks"),
  cacheKey("planner"),
];

export function useAttachAssignment(classId: string, id: string) {
  return useMutation(
    (input: { text: string; file: Attachment | null }) => assignmentRepository.attach(classId, id, input),
    { invalidate: () => invalidateAssignment(classId, id) },
  );
}

export function useTurnInAssignment(classId: string, id: string) {
  return useMutation(() => assignmentRepository.turnIn(classId, id), {
    invalidate: () => invalidateAssignment(classId, id),
  });
}
