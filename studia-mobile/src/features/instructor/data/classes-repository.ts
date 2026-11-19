// classes-repository.ts — DB-ready interface + in-memory mock. Swapping to the real API means
// replacing this file only; the hooks in hooks/use-classes.ts never change.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import { CLASS_DIRECTORY } from "@/features/instructor/data/class-directory";
import { newId } from "@/features/instructor/logic/format";
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

let CLASSES: InstructorClass[] = CLASS_DIRECTORY.map((c) => ({
  id: c.id,
  code: c.code,
  title: c.title,
  section: c.section,
  studentCount: c.studentCount,
  joinCode: c.joinCode,
  archived: false,
}));

class MockInstructorClassRepository implements InstructorClassRepository {
  list(): Promise<Result<InstructorClass[]>> {
    return mockCall(() => CLASSES.filter((c) => !c.archived));
  }

  get(id: string): Promise<Result<InstructorClass | null>> {
    return mockCall(() => CLASSES.find((c) => c.id === id) ?? null);
  }

  async create(input: { title: string; section: string; code: string }): Promise<Result<InstructorClass>> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const cls: InstructorClass = {
      id: newId("class"),
      code: input.code.trim(),
      title: input.title.trim(),
      section: input.section.trim(),
      studentCount: 0,
      joinCode: randomJoinCode(),
      archived: false,
    };
    CLASSES = [cls, ...CLASSES];
    return ok(cls);
  }

  async archive(id: string, archived: boolean): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!CLASSES.some((c) => c.id === id)) return fail(appError("not_found", "This class no longer exists."));
    CLASSES = CLASSES.map((c) => (c.id === id ? { ...c, archived } : c));
    return ok(undefined);
  }

  async remove(id: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!CLASSES.some((c) => c.id === id)) return fail(appError("not_found", "This class no longer exists."));
    CLASSES = CLASSES.filter((c) => c.id !== id);
    return ok(undefined);
  }
}

export const instructorClassRepository: InstructorClassRepository = new MockInstructorClassRepository();
