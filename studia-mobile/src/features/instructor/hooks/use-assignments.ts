// use-assignments.ts — instructor-authored assignments.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import type { AssignmentDraft } from "@/features/instructor/data/assignments-repository";
import { instructorAssignmentRepository } from "@/features/instructor/data/assignments-repository";

const listKey = (classId: string) => cacheKey("instructor", "classes", classId, "assignments");
const itemKey = (classId: string, id: string) => cacheKey("instructor", "classes", classId, "assignments", id);

export function useClassAssignments(classId: string | null) {
  return useQuery(classId ? listKey(classId) : null, () => instructorAssignmentRepository.listByClass(classId!), {
    ttlMs: TTL.static,
    enabled: !!classId,
  });
}

export function useInstructorAssignment(classId: string | null, id: string | null) {
  return useQuery(
    classId && id ? itemKey(classId, id) : null,
    () => instructorAssignmentRepository.get(classId!, id!),
    { ttlMs: TTL.static, enabled: !!classId && !!id },
  );
}

export function useCreateAssignment(classId: string) {
  return useMutation((draft: AssignmentDraft) => instructorAssignmentRepository.create(classId, draft), {
    invalidate: () => listKey(classId),
  });
}

export function useUpdateAssignment(classId: string, id: string) {
  return useMutation((draft: AssignmentDraft) => instructorAssignmentRepository.update(classId, id, draft), {
    invalidate: () => [listKey(classId), itemKey(classId, id)],
  });
}

export function useDeleteAssignment(classId: string) {
  return useMutation((id: string) => instructorAssignmentRepository.remove(classId, id), {
    invalidate: (id) => [listKey(classId), itemKey(classId, id)],
  });
}
