// students-repository.ts — roster per class, derived from the shared mock DB's enrollments and
// assignment submissions (submitted / pending / progress are computed, not typed).
import { isRemote } from "@/core/config/data-source";
import { RemoteClassStudentRepository } from "@/features/instructor/data/students-remote";
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { mockDb, type DbUser } from "@/core/data/mock/mock-db";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { ClassStudent } from "@/features/instructor/types/instructor";

export interface ClassStudentRepository {
  listByClass(classId: string): Promise<Result<ClassStudent[]>>;
  get(classId: string, studentId: string): Promise<Result<ClassStudent | null>>;
  remove(classId: string, studentId: string): Promise<Result<void>>;
}

function toClassStudent(classId: string, u: DbUser): ClassStudent {
  const assignments = mockDb.assignmentsOf(classId);
  const submitted = assignments.filter((a) => mockDb.isTurnedIn(mockDb.submissionOf(a.id, u.id))).length;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    section: mockDb.cls(classId)?.section ?? "",
    progress: mockDb.progressOf(classId, u.id),
    submittedCount: submitted,
    pendingCount: assignments.length - submitted,
  };
}

class MockClassStudentRepository implements ClassStudentRepository {
  listByClass(classId: string): Promise<Result<ClassStudent[]>> {
    return mockCall(() =>
      mockDb.studentsOf(classId).map((u) => toClassStudent(classId, u)).sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  get(classId: string, studentId: string): Promise<Result<ClassStudent | null>> {
    return mockCall(() => {
      const u = mockDb.isEnrolled(classId, studentId) ? mockDb.user(studentId) : undefined;
      return u ? toClassStudent(classId, u) : null;
    });
  }

  async remove(classId: string, studentId: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!mockDb.isEnrolled(classId, studentId)) return fail(appError("not_found", "This student is not in the class."));
    mockDb.enrollments = mockDb.enrollments.filter((e) => !(e.classId === classId && e.studentId === studentId));
    mockDb.emit();
    return ok(undefined);
  }
}

export const classStudentRepository: ClassStudentRepository = isRemote ? new RemoteClassStudentRepository() : new MockClassStudentRepository();
