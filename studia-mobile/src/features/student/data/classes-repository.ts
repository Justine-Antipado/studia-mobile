// classes-repository.ts — DB-ready interface + in-memory mock. Swapping to the real API means
// replacing this file only; useClasses()/useClass() in hooks/use-classes.ts never change.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import { CLASS_DIRECTORY, JOIN_CODES } from "@/features/student/data/class-directory";
import type { StudentClass } from "@/features/student/types/student";

export interface ClassRepository {
  list(): Promise<Result<StudentClass[]>>;
  get(id: string): Promise<Result<StudentClass | null>>;
  joinByCode(code: string): Promise<Result<StudentClass>>;
  leave(id: string): Promise<Result<void>>;
}

const PROGRESS: Record<string, number> = { it321: 0.7, it314: 0.45, it318: 0.3, ge105: 0.8 };
const joined = new Set<string>(["it321", "it314", "it318", "ge105"]);

function toStudentClass(id: string): StudentClass | undefined {
  const facts = CLASS_DIRECTORY.find((c) => c.id === id);
  if (!facts) return undefined;
  return {
    id: facts.id,
    code: facts.code,
    title: facts.title,
    section: facts.section,
    teacher: facts.teacher,
    progress: PROGRESS[facts.id] ?? 0,
    joinCode: JOIN_CODES[facts.id] ?? "",
  };
}

class MockClassRepository implements ClassRepository {
  list(): Promise<Result<StudentClass[]>> {
    return mockCall(() => Array.from(joined).map((id) => toStudentClass(id)!).filter(Boolean));
  }

  get(id: string): Promise<Result<StudentClass | null>> {
    return mockCall(() => (joined.has(id) ? toStudentClass(id) ?? null : null));
  }

  async joinByCode(code: string): Promise<Result<StudentClass>> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const facts = CLASS_DIRECTORY.find((c) => JOIN_CODES[c.id] === code.trim().toUpperCase());
    if (!facts) return fail(appError("not_found", "No class matches that code. Check it and try again."));
    if (joined.has(facts.id)) return fail(appError("conflict", "You already joined this class.", false));
    joined.add(facts.id);
    PROGRESS[facts.id] = 0;
    return ok(toStudentClass(facts.id)!);
  }

  async leave(id: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!joined.has(id)) return fail(appError("not_found", "You are not in this class."));
    joined.delete(id);
    return ok(undefined);
  }
}

export const classRepository: ClassRepository = new MockClassRepository();
