// assignment-submissions-repository.ts — instructor's view of who turned in an assignment.
// The list is the class roster LEFT-joined with submissions, so students who never started show
// up as "missing". Server rule (docs/api-contract.md): only the class owner may list or grade.
import { isRemote } from "@/core/config/data-source";
import { RemoteAssignmentSubmissionRepository } from "@/features/instructor/data/assignment-submissions-remote";
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { ME, mockDb, type DbSubmission } from "@/core/data/mock/mock-db";
import { classCodeOf, notify } from "@/core/data/mock/mock-notifications";
import { mockCall } from "@/core/data/mock/mock-latency";
import { parseScore } from "@/features/instructor/logic/quiz-validation";
import type { Attachment } from "@/features/instructor/types/instructor";
import { mockNowIso } from "@/core/data/mock/mock-clock";

export type AssignmentSubmissionStatus = "missing" | "draft" | "submitted" | "late" | "graded";

export type AssignmentSubmission = {
  assignmentId: string;
  studentId: string;
  studentName: string;
  status: AssignmentSubmissionStatus;
  submittedAt: string | null;
  text: string | null;
  file: Attachment | null;
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
};

export interface AssignmentSubmissionRepository {
  listByAssignment(classId: string, assignmentId: string): Promise<Result<AssignmentSubmission[]>>;
  get(classId: string, assignmentId: string, studentId: string): Promise<Result<AssignmentSubmission | null>>;
  grade(
    classId: string,
    assignmentId: string,
    studentId: string,
    scoreInput: string,
    feedback: string,
  ): Promise<Result<AssignmentSubmission>>;
}

const ownsClass = (classId: string) => mockDb.cls(classId)?.ownerId === ME.instructor;

function row(assignmentId: string, studentId: string, studentName: string): AssignmentSubmission {
  const s: DbSubmission | undefined = mockDb.submissionOf(assignmentId, studentId);
  return {
    assignmentId,
    studentId,
    studentName,
    status: s?.status ?? "missing",
    submittedAt: s?.submittedAt ?? null,
    text: s?.text ?? null,
    file: s?.file ?? null,
    score: s?.score ?? null,
    feedback: s?.feedback ?? null,
    gradedAt: s?.gradedAt ?? null,
  };
}

class MockAssignmentSubmissionRepository implements AssignmentSubmissionRepository {
  listByAssignment(classId: string, assignmentId: string): Promise<Result<AssignmentSubmission[]>> {
    return mockCall(() => {
      const a = mockDb.assignmentsOf(classId).find((x) => x.id === assignmentId);
      if (!a || !ownsClass(classId)) return [];
      return mockDb
        .studentsOf(classId)
        .map((u) => row(assignmentId, u.id, u.name))
        .sort((x, y) => x.studentName.localeCompare(y.studentName));
    });
  }

  get(classId: string, assignmentId: string, studentId: string): Promise<Result<AssignmentSubmission | null>> {
    return mockCall(() => {
      const u = mockDb.studentsOf(classId).find((x) => x.id === studentId);
      const a = mockDb.assignmentsOf(classId).find((x) => x.id === assignmentId);
      return u && a && ownsClass(classId) ? row(assignmentId, studentId, u.name) : null;
    });
  }

  async grade(
    classId: string,
    assignmentId: string,
    studentId: string,
    scoreInput: string,
    feedback: string,
  ): Promise<Result<AssignmentSubmission>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const a = mockDb.assignmentsOf(classId).find((x) => x.id === assignmentId);
    const student = mockDb.studentsOf(classId).find((x) => x.id === studentId);
    if (!a || !student || !ownsClass(classId)) return fail(appError("not_found", "This submission no longer exists."));
    const current = mockDb.submissionOf(assignmentId, studentId);
    if (!current || current.status === "draft") {
      return fail(appError("conflict", "The student has not turned this in yet.", false));
    }
    const parsed = parseScore(scoreInput, a.points);
    if (!parsed.ok) return fail(appError("validation", parsed.error, false));
    const next: DbSubmission = {
      ...current,
      status: "graded",
      score: parsed.value,
      feedback: feedback.trim() || null,
      gradedAt: mockNowIso(),
    };
    mockDb.submissions = mockDb.submissions.map((s) => (s.id === next.id ? next : s));
    mockDb.emit();
    notify([studentId], {
      tag: "Grade",
      title: `${a.title} graded`,
      meta: `You scored ${parsed.value}/${a.points} · ${classCodeOf(classId)}`,
      body: next.feedback ?? undefined,
    });
    return ok(row(assignmentId, studentId, student.name));
  }
}

export const assignmentSubmissionRepository: AssignmentSubmissionRepository = isRemote
  ? new RemoteAssignmentSubmissionRepository()
  : new MockAssignmentSubmissionRepository();
