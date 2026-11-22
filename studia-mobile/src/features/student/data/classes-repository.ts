// classes-repository.ts — student view over the shared mock DB (core/data/mock/mock-db.ts).
// Joining/leaving edits the enrollments table, so the instructor roster and student count change
// too. Progress is derived from the assignments this student has turned in.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { ME, mockDb, type DbClass } from "@/core/data/mock/mock-db";
import { nameOf, notify } from "@/core/data/mock/mock-notifications";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { StudentClass } from "@/features/student/types/student";

export interface ClassRepository {
  list(): Promise<Result<StudentClass[]>>;
  get(id: string): Promise<Result<StudentClass | null>>;
  joinByCode(code: string): Promise<Result<StudentClass>>;
  leave(id: string): Promise<Result<void>>;
}

function toStudentClass(c: DbClass): StudentClass {
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    section: c.section,
    teacher: `Prof. ${mockDb.user(c.ownerId)?.name ?? "Instructor"}`,
    progress: mockDb.progressOf(c.id, ME.student),
  };
}

class MockClassRepository implements ClassRepository {
  list(): Promise<Result<StudentClass[]>> {
    return mockCall(() => mockDb.classesOfStudent(ME.student).map(toStudentClass));
  }

  get(id: string): Promise<Result<StudentClass | null>> {
    return mockCall(() => {
      const c = mockDb.cls(id);
      return c && !c.archived && mockDb.isEnrolled(id, ME.student) ? toStudentClass(c) : null;
    });
  }

  async joinByCode(code: string): Promise<Result<StudentClass>> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const c = mockDb.classes.find((x) => !x.archived && x.joinCode === code.trim().toUpperCase());
    if (!c) return fail(appError("not_found", "No class matches that code. Check it and try again."));
    if (mockDb.isEnrolled(c.id, ME.student)) return fail(appError("conflict", "You already joined this class.", false));
    mockDb.enrollments = [...mockDb.enrollments, { classId: c.id, studentId: ME.student }];
    mockDb.emit();
    notify([c.ownerId], { tag: "Class", title: `${nameOf(ME.student)} joined your class`, meta: `${c.code} · ${c.section}` });
    return ok(toStudentClass(c));
  }

  async leave(id: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!mockDb.isEnrolled(id, ME.student)) return fail(appError("not_found", "You are not in this class."));
    mockDb.enrollments = mockDb.enrollments.filter((e) => !(e.classId === id && e.studentId === ME.student));
    mockDb.emit();
    return ok(undefined);
  }
}

export const classRepository: ClassRepository = new MockClassRepository();
