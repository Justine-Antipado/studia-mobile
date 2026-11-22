// class-directory.ts — class facts for the student repositories, read from the shared mock DB
// (core/data/mock/mock-db.ts) so student and instructor always agree on code/section/teacher.
import { mockDb } from "@/core/data/mock/mock-db";
import type { Person } from "@/features/student/types/student";

export type ClassFacts = { id: string; code: string; title: string; section: string; teacher: string };

export function classFacts(classId: string): ClassFacts | undefined {
  const c = mockDb.cls(classId);
  if (!c) return undefined;
  const owner = mockDb.user(c.ownerId)?.name ?? "Instructor";
  return { id: c.id, code: c.code, title: c.title, section: c.section, teacher: `Prof. ${owner}` };
}

/** Snapshot of the seeded classes (used by repositories that seed content per class). */
export const CLASS_DIRECTORY: readonly ClassFacts[] = mockDb.classes
  .map((c) => classFacts(c.id))
  .filter((c): c is ClassFacts => !!c);

/** Everyone enrolled in the class except the signed-in student. */
export function classmatesOf(classId: string, meId: string): Person[] {
  return mockDb
    .studentsOf(classId)
    .filter((u) => u.id !== meId)
    .map((u) => ({ id: u.id, name: u.name, role: "student" as const }));
}
