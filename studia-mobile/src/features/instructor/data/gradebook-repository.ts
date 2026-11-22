// gradebook-repository.ts — one row per (student, assignment-or-quiz) for the classes this
// instructor owns. The gradebook screen filters and aggregates these rows; it never joins by class
// code (two sections can share a code), only by classId.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteGradebookRepository } from "@/features/instructor/data/gradebook-remote";

export type GradeKind = "assignment" | "quiz";
/** graded = has a final score; pending = turned in, waiting for the instructor; missing = nothing turned in. */
export type GradeStatus = "graded" | "pending" | "missing";

export type GradeEntry = {
  id: string;
  classId: string;
  classCode: string;
  kind: GradeKind;
  refId: string;
  title: string;
  studentId: string;
  studentName: string;
  score: number | null;
  max: number;
  status: GradeStatus;
  gradedAt: string | null;
  /** Quiz attempt id (opens the quiz grading screen); null when nothing was submitted. */
  attemptId: string | null;
};

export interface GradebookRepository {
  /** Entries for one class, or for every class the instructor owns when classId is null. */
  list(classId: string | null): Promise<Result<GradeEntry[]>>;
}

export const gradebookRepository: GradebookRepository = new RemoteGradebookRepository();
