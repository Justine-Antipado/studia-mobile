// class-directory.ts — class facts for the instructor repositories, read from the shared mock DB
// (core/data/mock/mock-db.ts). studentCount is derived from enrollments, never typed.
import { ME, mockDb } from "@/core/data/mock/mock-db";

export type ClassFacts = {
  id: string;
  code: string;
  title: string;
  section: string;
  studentCount: number;
  joinCode: string;
};

export function classFacts(classId: string): ClassFacts | undefined {
  const c = mockDb.cls(classId);
  if (!c) return undefined;
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    section: c.section,
    studentCount: mockDb.studentsOf(c.id).length,
    joinCode: c.joinCode,
  };
}

/** Snapshot of the classes the signed-in instructor owns (used to seed per-class content). */
export const CLASS_DIRECTORY: readonly ClassFacts[] = mockDb.classes
  .filter((c) => c.ownerId === ME.instructor)
  .map((c) => classFacts(c.id))
  .filter((c): c is ClassFacts => !!c);
