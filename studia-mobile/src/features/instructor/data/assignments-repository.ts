// assignments-repository.ts — instructor-authored assignments: create, edit, delete. A view over
// the shared mock DB, so what is created here is what students see in their To-do.
import { isRemote } from "@/core/config/data-source";
import { RemoteInstructorAssignmentRepository } from "@/features/instructor/data/assignments-remote";
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { ME, dbId, mockDb, type DbAssignment } from "@/core/data/mock/mock-db";
import { classCodeOf, notify, studentIdsOf } from "@/core/data/mock/mock-notifications";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { Attachment, InstructorAssignment } from "@/features/instructor/types/instructor";
import { mockNowIso } from "@/core/data/mock/mock-clock";

export type AssignmentDraft = {
  title: string;
  instructions: string;
  dueAt: string;
  points: number;
  allowLate: boolean;
  attachments: Attachment[];
};

export interface InstructorAssignmentRepository {
  listByClass(classId: string): Promise<Result<InstructorAssignment[]>>;
  get(classId: string, id: string): Promise<Result<InstructorAssignment | null>>;
  create(classId: string, draft: AssignmentDraft): Promise<Result<InstructorAssignment>>;
  update(classId: string, id: string, draft: AssignmentDraft): Promise<Result<InstructorAssignment>>;
  remove(classId: string, id: string): Promise<Result<void>>;
}

const ownsClass = (classId: string) => mockDb.cls(classId)?.ownerId === ME.instructor;

class MockInstructorAssignmentRepository implements InstructorAssignmentRepository {
  listByClass(classId: string): Promise<Result<InstructorAssignment[]>> {
    return mockCall(() =>
      ownsClass(classId) ? mockDb.assignmentsOf(classId).sort((a, b) => a.dueAt.localeCompare(b.dueAt)) : [],
    );
  }

  get(classId: string, id: string): Promise<Result<InstructorAssignment | null>> {
    return mockCall(() =>
      ownsClass(classId) ? (mockDb.assignmentsOf(classId).find((a) => a.id === id) ?? null) : null,
    );
  }

  async create(classId: string, draft: AssignmentDraft): Promise<Result<InstructorAssignment>> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (!ownsClass(classId)) return fail(appError("not_found", "This class no longer exists."));
    const assignment: DbAssignment = {
      id: dbId("as"),
      classId,
      title: draft.title.trim(),
      instructions: draft.instructions.trim(),
      dueAt: draft.dueAt,
      points: draft.points,
      allowLate: draft.allowLate,
      attachments: draft.attachments,
      createdAt: mockNowIso(),
    };
    mockDb.assignments = [assignment, ...mockDb.assignments];
    mockDb.emit();
    notify(studentIdsOf(classId), {
      tag: "Reminder",
      title: `New assignment: ${assignment.title}`,
      meta: `${classCodeOf(classId)} · ${assignment.points} points`,
      body: assignment.instructions.slice(0, 280),
    });
    return ok(assignment);
  }

  async update(classId: string, id: string, draft: AssignmentDraft): Promise<Result<InstructorAssignment>> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const current = mockDb.assignmentsOf(classId).find((a) => a.id === id);
    if (!current || !ownsClass(classId)) return fail(appError("not_found", "This assignment no longer exists."));
    // Rule: points cannot drop below a score that was already given.
    const highest = mockDb.submissions
      .filter((s) => s.assignmentId === id && s.score !== null)
      .reduce((m, s) => Math.max(m, s.score ?? 0), 0);
    if (draft.points < highest) {
      return fail(appError("validation", `A student already scored ${highest}. Points can't be lower than that.`, false));
    }
    const next: DbAssignment = {
      ...current,
      title: draft.title.trim(),
      instructions: draft.instructions.trim(),
      dueAt: draft.dueAt,
      points: draft.points,
      allowLate: draft.allowLate,
      attachments: draft.attachments,
    };
    mockDb.assignments = mockDb.assignments.map((a) => (a.id === id ? next : a));
    // Rule: moving the due date re-tags turned-in work ("late" <-> "submitted"); graded stays graded.
    const dueMs = new Date(next.dueAt).getTime();
    mockDb.submissions = mockDb.submissions.map((s) => {
      if (s.assignmentId !== id || !s.submittedAt || (s.status !== "submitted" && s.status !== "late")) return s;
      return { ...s, status: new Date(s.submittedAt).getTime() > dueMs ? "late" : "submitted" };
    });
    mockDb.emit();
    if (next.dueAt !== current.dueAt) {
      notify(studentIdsOf(classId), {
        tag: "Reminder",
        title: `Due date changed: ${next.title}`,
        meta: classCodeOf(classId),
        body: `The new due date is ${new Date(next.dueAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })}.`,
      });
    }
    return ok(next);
  }

  async remove(classId: string, id: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!ownsClass(classId) || !mockDb.assignmentsOf(classId).some((a) => a.id === id)) {
      return fail(appError("not_found", "This assignment no longer exists."));
    }
    mockDb.assignments = mockDb.assignments.filter((a) => a.id !== id);
    mockDb.submissions = mockDb.submissions.filter((s) => s.assignmentId !== id);
    mockDb.emit();
    return ok(undefined);
  }
}

export const instructorAssignmentRepository: InstructorAssignmentRepository = isRemote
  ? new RemoteInstructorAssignmentRepository()
  : new MockInstructorAssignmentRepository();
