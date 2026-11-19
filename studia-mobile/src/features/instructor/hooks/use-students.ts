// use-students.ts — class roster.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { classStudentRepository } from "@/features/instructor/data/students-repository";

export function useClassStudents(classId: string | null) {
  return useQuery(
    classId ? cacheKey("instructor", "classes", classId, "students") : null,
    () => classStudentRepository.listByClass(classId!),
    { ttlMs: TTL.static, enabled: !!classId },
  );
}

export function useStudent(classId: string | null, studentId: string | null) {
  return useQuery(
    classId && studentId ? cacheKey("instructor", "classes", classId, "students", studentId) : null,
    () => classStudentRepository.get(classId!, studentId!),
    { ttlMs: TTL.static, enabled: !!classId && !!studentId },
  );
}

export function useRemoveStudent(classId: string) {
  return useMutation((studentId: string) => classStudentRepository.remove(classId, studentId), {
    invalidate: (studentId) => [
      cacheKey("instructor", "classes", classId, "students"),
      cacheKey("instructor", "classes", classId, "students", studentId),
    ],
  });
}
