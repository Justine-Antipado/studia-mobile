// assignments-repository.ts — instructor-authored assignments: create, edit, delete.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import { newId } from "@/features/instructor/logic/format";
import type { Attachment, InstructorAssignment } from "@/features/instructor/types/instructor";

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

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

let ASSIGNMENTS: InstructorAssignment[] = [
  {
    id: "ias1",
    classId: "it321",
    title: "Firewall Rule Design Exercise",
    instructions: "Design an iptables-style rule set for a small office network (1 server, 10 workstations). Submit as a PDF.",
    dueAt: hoursFromNow(30),
    points: 20,
    allowLate: true,
    attachments: [{ id: "iia1", name: "Exercise_Brief.pdf", kind: "pdf", sizeLabel: "420 KB" }],
    createdAt: hoursFromNow(-48),
  },
  {
    id: "ias2",
    classId: "it321",
    title: "CIA Triad Reflection Paper",
    instructions: "Write a one-page reflection on how the CIA triad applies to a system you use daily.",
    dueAt: hoursFromNow(-20),
    points: 10,
    allowLate: false,
    attachments: [],
    createdAt: hoursFromNow(-96),
  },
  {
    id: "ias3",
    classId: "it314",
    title: "REST API Design Proposal",
    instructions: "Propose resource names and HTTP verbs for a simple library system API.",
    dueAt: hoursFromNow(50),
    points: 15,
    allowLate: true,
    attachments: [],
    createdAt: hoursFromNow(-24),
  },
];

class MockInstructorAssignmentRepository implements InstructorAssignmentRepository {
  listByClass(classId: string): Promise<Result<InstructorAssignment[]>> {
    return mockCall(() => ASSIGNMENTS.filter((a) => a.classId === classId).sort((a, b) => a.dueAt.localeCompare(b.dueAt)));
  }

  get(classId: string, id: string): Promise<Result<InstructorAssignment | null>> {
    return mockCall(() => ASSIGNMENTS.find((a) => a.classId === classId && a.id === id) ?? null);
  }

  async create(classId: string, draft: AssignmentDraft): Promise<Result<InstructorAssignment>> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const assignment: InstructorAssignment = {
      id: newId("as"),
      classId,
      title: draft.title.trim(),
      instructions: draft.instructions.trim(),
      dueAt: draft.dueAt,
      points: draft.points,
      allowLate: draft.allowLate,
      attachments: draft.attachments,
      createdAt: new Date().toISOString(),
    };
    ASSIGNMENTS = [assignment, ...ASSIGNMENTS];
    return ok(assignment);
  }

  async update(classId: string, id: string, draft: AssignmentDraft): Promise<Result<InstructorAssignment>> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const current = ASSIGNMENTS.find((a) => a.classId === classId && a.id === id);
    if (!current) return fail(appError("not_found", "This assignment no longer exists."));
    const next: InstructorAssignment = {
      ...current,
      title: draft.title.trim(),
      instructions: draft.instructions.trim(),
      dueAt: draft.dueAt,
      points: draft.points,
      allowLate: draft.allowLate,
      attachments: draft.attachments,
    };
    ASSIGNMENTS = ASSIGNMENTS.map((a) => (a.id === id ? next : a));
    return ok(next);
  }

  async remove(classId: string, id: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!ASSIGNMENTS.some((a) => a.classId === classId && a.id === id)) {
      return fail(appError("not_found", "This assignment no longer exists."));
    }
    ASSIGNMENTS = ASSIGNMENTS.filter((a) => a.id !== id);
    return ok(undefined);
  }
}

export const instructorAssignmentRepository: InstructorAssignmentRepository = new MockInstructorAssignmentRepository();
