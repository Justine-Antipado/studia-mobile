// classes-repository.ts — instructor view over the shared mock DB. Only classes this instructor
// owns are listed; studentCount is derived from enrollments.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { ME, dbId, mockDb, type DbClass } from "@/core/data/mock/mock-db";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { InstructorClass } from "@/features/instructor/types/instructor";

export interface InstructorClassRepository {
  list(): Promise<Result<InstructorClass[]>>;
  get(id: string): Promise<Result<InstructorClass | null>>;
  create(input: { title: string; section: string; code: string }): Promise<Result<InstructorClass>>;
  archive(id: string, archived: boolean): Promise<Result<void>>;
  remove(id: string): Promise<Result<void>>;
}

function randomJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const owned = (c: DbClass) => c.ownerId === ME.instructor;

const toInstructorClass = (c: DbClass): InstructorClass => ({
  id: c.id,
  code: c.code,
  title: c.title,
  section: c.section,
  studentCount: mockDb.studentsOf(c.id).length,
  joinCode: c.joinCode,
  archived: c.archived,
});

class MockInstructorClassRepository implements InstructorClassRepository {
  list(): Promise<Result<InstructorClass[]>> {
    return mockCall(() => mockDb.classes.filter((c) => owned(c) && !c.archived).map(toInstructorClass));
  }

  get(id: string): Promise<Result<InstructorClass | null>> {
    return mockCall(() => {
      const c = mockDb.cls(id);
      return c && owned(c) ? toInstructorClass(c) : null;
    });
  }

  async create(input: { title: string; section: string; code: string }): Promise<Result<InstructorClass>> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const c: DbClass = {
      id: dbId("class"),
      code: input.code.trim(),
      title: input.title.trim(),
      section: input.section.trim(),
      ownerId: ME.instructor,
      joinCode: randomJoinCode(),
      archived: false,
    };
    mockDb.classes = [c, ...mockDb.classes];
    mockDb.emit();
    return ok(toInstructorClass(c));
  }

  async archive(id: string, archived: boolean): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const c = mockDb.cls(id);
    if (!c || !owned(c)) return fail(appError("not_found", "This class no longer exists."));
    mockDb.classes = mockDb.classes.map((x) => (x.id === id ? { ...x, archived } : x));
    mockDb.emit();
    return ok(undefined);
  }

  async remove(id: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const c = mockDb.cls(id);
    if (!c || !owned(c)) return fail(appError("not_found", "This class no longer exists."));
    mockDb.classes = mockDb.classes.filter((x) => x.id !== id);
    mockDb.enrollments = mockDb.enrollments.filter((e) => e.classId !== id);
    mockDb.emit();
    return ok(undefined);
  }
}

export const instructorClassRepository: InstructorClassRepository = new MockInstructorClassRepository();
