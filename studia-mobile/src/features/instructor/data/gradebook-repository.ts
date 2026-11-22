// gradebook-repository.ts — one row per (student, assignment-or-quiz) for the classes this
// instructor owns, computed from the shared mock DB. The gradebook screen filters and aggregates
// these rows; it never joins by class code (two sections can share a code), only by classId.
import type { Result } from "@/core/data/errors/app-error";
import { ME, mockDb } from "@/core/data/mock/mock-db";
import { mockCall } from "@/core/data/mock/mock-latency";
import { finalScore, maxScoreOf, needsGrading } from "@/core/data/mock/mock-quizzes";

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

function build(classId: string | null): GradeEntry[] {
  const out: GradeEntry[] = [];
  const classes = mockDb.classes.filter((c) => c.ownerId === ME.instructor && (!classId || c.id === classId));

  for (const cls of classes) {
    const students = mockDb.studentsOf(cls.id);

    for (const a of mockDb.assignmentsOf(cls.id)) {
      for (const u of students) {
        const s = mockDb.submissionOf(a.id, u.id);
        const status: GradeStatus = s?.status === "graded" ? "graded" : s && s.status !== "draft" ? "pending" : "missing";
        out.push({
          id: `as_${a.id}_${u.id}`,
          classId: cls.id,
          classCode: cls.code,
          kind: "assignment",
          refId: a.id,
          title: a.title,
          studentId: u.id,
          studentName: u.name,
          score: status === "graded" ? (s?.score ?? null) : null,
          max: a.points,
          status,
          gradedAt: s?.gradedAt ?? null,
          attemptId: null,
        });
      }
    }

    for (const q of mockDb.quizzes.filter((x) => x.classId === cls.id && x.status === "published")) {
      for (const u of students) {
        const att = mockDb.attempts.find((x) => x.quizId === q.id && x.studentId === u.id);
        const status: GradeStatus = !att ? "missing" : needsGrading(q, att) ? "pending" : "graded";
        out.push({
          id: `qz_${q.id}_${u.id}`,
          classId: cls.id,
          classCode: cls.code,
          kind: "quiz",
          refId: q.id,
          title: q.title,
          studentId: u.id,
          studentName: u.name,
          score: att && status === "graded" ? finalScore(q, att) : null,
          max: maxScoreOf(q),
          status,
          gradedAt: att?.gradedAt ?? null,
          attemptId: att?.id ?? null,
        });
      }
    }
  }
  return out;
}

class MockGradebookRepository implements GradebookRepository {
  list(classId: string | null): Promise<Result<GradeEntry[]>> {
    return mockCall(() => build(classId));
  }
}

export const gradebookRepository: GradebookRepository = new MockGradebookRepository();
