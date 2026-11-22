// use-assignment-submissions.ts — who turned in an assignment, and grading it.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { assignmentSubmissionRepository } from "@/features/instructor/data/assignment-submissions-repository";

const listKey = (classId: string, assignmentId: string) =>
  cacheKey("instructor", "classes", classId, "assignments", assignmentId, "submissions");

export function useAssignmentSubmissions(classId: string | null, assignmentId: string | null) {
  return useQuery(
    classId && assignmentId ? listKey(classId, assignmentId) : null,
    () => assignmentSubmissionRepository.listByAssignment(classId!, assignmentId!),
    { ttlMs: TTL.live, enabled: !!classId && !!assignmentId },
  );
}

export function useGradeAssignmentSubmission(classId: string, assignmentId: string, studentId: string) {
  return useMutation(
    ({ score, feedback }: { score: string; feedback: string }) =>
      assignmentSubmissionRepository.grade(classId, assignmentId, studentId, score, feedback),
    { invalidate: () => [listKey(classId, assignmentId), cacheKey("instructor", "gradebook")] },
  );
}
