// students-repository.ts — roster per class: progress, submissions, and removal.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { ClassStudent } from "@/features/instructor/types/instructor";

export interface ClassStudentRepository {
  listByClass(classId: string): Promise<Result<ClassStudent[]>>;
  get(classId: string, studentId: string): Promise<Result<ClassStudent | null>>;
  remove(classId: string, studentId: string): Promise<Result<void>>;
}

const NAMES = [
  "Juan Dela Cruz", "Ana Villanueva", "Mark Bautista", "Liza Mercado", "Carlo Dizon",
  "Rica Santiago", "Kristine Bautista", "Paolo Mendoza", "Jasmine Ramos", "Angelica Flores",
];

function seedFor(classId: string): ClassStudent[] {
  return NAMES.map((name, i) => ({
    id: `${classId}_s${i}`,
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@omsc.edu.ph`,
    section: "BSIT 3-A",
    progress: Math.round(((i * 7 + 35) % 65) + 30) / 100,
    submittedCount: 3 + (i % 3),
    pendingCount: i % 3,
  }));
}

const ROSTERS = new Map<string, ClassStudent[]>();
function rosterFor(classId: string): ClassStudent[] {
  if (!ROSTERS.has(classId)) ROSTERS.set(classId, seedFor(classId));
  return ROSTERS.get(classId)!;
}

class MockClassStudentRepository implements ClassStudentRepository {
  listByClass(classId: string): Promise<Result<ClassStudent[]>> {
    return mockCall(() => [...rosterFor(classId)].sort((a, b) => a.name.localeCompare(b.name)));
  }

  get(classId: string, studentId: string): Promise<Result<ClassStudent | null>> {
    return mockCall(() => rosterFor(classId).find((s) => s.id === studentId) ?? null);
  }

  async remove(classId: string, studentId: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const roster = rosterFor(classId);
    if (!roster.some((s) => s.id === studentId)) return fail(appError("not_found", "This student is not in the class."));
    ROSTERS.set(classId, roster.filter((s) => s.id !== studentId));
    return ok(undefined);
  }
}

export const classStudentRepository: ClassStudentRepository = new MockClassStudentRepository();
