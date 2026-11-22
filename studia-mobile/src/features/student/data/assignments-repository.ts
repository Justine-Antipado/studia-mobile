// assignments-repository.ts — student view over the shared mock DB. An assignment is the
// instructor's row; "my" submission is the row in `submissions` for the signed-in student, so a
// turn-in here shows up in the instructor's Submissions list (and a grade shows up here).
// Late rule: allowLate=true -> submitting after dueAt is tagged "late". allowLate=false and
// already overdue -> a picked file is saved as a draft only; "Turn in" (reopening) submits it
// without a late tag, per docs/UI-BRIEF business rules.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { ME, dbId, mockDb, type DbAssignment, type DbSubmission } from "@/core/data/mock/mock-db";
import { classCodeOf, nameOf, notify, ownerOf } from "@/core/data/mock/mock-notifications";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { Assignment, Attachment } from "@/features/student/types/student";

export interface AssignmentRepository {
  listByClass(classId: string): Promise<Result<Assignment[]>>;
  get(classId: string, id: string): Promise<Result<Assignment | null>>;
  /** Attach a file/text. May submit immediately, or save as a draft (see rule above). */
  attach(classId: string, id: string, input: { text: string; file: Attachment | null }): Promise<Result<Assignment>>;
  /** Turns in a previously attached draft. Only valid while status is "draft". */
  turnIn(classId: string, id: string): Promise<Result<Assignment>>;
}

function toAssignment(a: DbAssignment): Assignment {
  const s = mockDb.submissionOf(a.id, ME.student);
  return {
    id: a.id,
    classId: a.classId,
    title: a.title,
    instructions: a.instructions,
    dueAt: a.dueAt,
    points: a.points,
    allowLate: a.allowLate,
    attachments: a.attachments,
    status: s?.status ?? "assigned",
    submittedAt: s?.submittedAt ?? null,
    submissionText: s?.text ?? null,
    submissionFile: s?.file ?? null,
    score: s?.score ?? null,
    feedback: s?.feedback ?? null,
  };
}

const visible = (a: DbAssignment | undefined, classId: string) =>
  !!a && a.classId === classId && mockDb.isEnrolled(classId, ME.student);

function save(next: DbSubmission, a: DbAssignment) {
  const exists = mockDb.submissions.some((s) => s.id === next.id);
  mockDb.submissions = exists ? mockDb.submissions.map((s) => (s.id === next.id ? next : s)) : [...mockDb.submissions, next];
  mockDb.emit();
  // A draft is not turned in, so the instructor is only told once real work arrives.
  const owner = ownerOf(a.classId);
  if (next.status !== "draft" && owner) {
    notify([owner], {
      tag: "Grade",
      title: `${nameOf(ME.student)} turned in ${a.title}`,
      meta: `${classCodeOf(a.classId)}${next.status === "late" ? " · Late" : ""}`,
    });
  }
}

class MockAssignmentRepository implements AssignmentRepository {
  listByClass(classId: string): Promise<Result<Assignment[]>> {
    return mockCall(() =>
      mockDb.isEnrolled(classId, ME.student)
        ? mockDb.assignmentsOf(classId).map(toAssignment).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        : [],
    );
  }

  get(classId: string, id: string): Promise<Result<Assignment | null>> {
    return mockCall(() => {
      const a = mockDb.assignments.find((x) => x.id === id);
      return visible(a, classId) ? toAssignment(a!) : null;
    });
  }

  async attach(
    classId: string,
    id: string,
    input: { text: string; file: Attachment | null },
  ): Promise<Result<Assignment>> {
    await new Promise((resolve) => setTimeout(resolve, 450));
    const a = mockDb.assignments.find((x) => x.id === id);
    if (!a || !visible(a, classId)) return fail(appError("not_found", "This assignment no longer exists."));
    const current = mockDb.submissionOf(id, ME.student);
    if (current && current.status !== "draft") {
      return fail(appError("conflict", "This was already turned in.", false));
    }

    const overdue = Date.now() > new Date(a.dueAt).getTime();
    const willSubmitNow = a.allowLate || !overdue;

    save({
      id: current?.id ?? dbId("sb"),
      assignmentId: id,
      studentId: ME.student,
      status: willSubmitNow ? (overdue ? "late" : "submitted") : "draft",
      submittedAt: willSubmitNow ? new Date().toISOString() : null,
      text: input.text || current?.text || null,
      file: input.file ?? current?.file ?? null,
      score: null,
      feedback: null,
      gradedAt: null,
    }, a);
    return ok(toAssignment(a));
  }

  async turnIn(classId: string, id: string): Promise<Result<Assignment>> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const a = mockDb.assignments.find((x) => x.id === id);
    if (!a || !visible(a, classId)) return fail(appError("not_found", "This assignment no longer exists."));
    const current = mockDb.submissionOf(id, ME.student);
    if (!current || current.status !== "draft") return fail(appError("conflict", "Nothing to turn in.", false));
    save({ ...current, status: "submitted", submittedAt: new Date().toISOString() }, a);
    return ok(toAssignment(a));
  }
}

export const assignmentRepository: AssignmentRepository = new MockAssignmentRepository();
