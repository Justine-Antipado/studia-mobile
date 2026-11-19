// assignments-repository.ts — assignment detail + submission.
// Late rule: allowLate=true -> submitting after dueAt is tagged "late". allowLate=false and
// already overdue -> a picked file is saved as a draft only; "Turn in" (reopening) submits it
// without a late tag, per docs/UI-BRIEF business rules.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
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

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

let ASSIGNMENTS: Assignment[] = [
  {
    id: "as1",
    classId: "it321",
    title: "Firewall Rule Design Exercise",
    instructions: "Design an iptables-style rule set for a small office network (1 server, 10 workstations). Submit as a PDF.",
    dueAt: hoursFromNow(30),
    points: 20,
    allowLate: true,
    attachments: [{ id: "ia1", name: "Exercise_Brief.pdf", kind: "pdf", sizeLabel: "420 KB" }],
    status: "assigned",
    submittedAt: null,
    submissionText: null,
    submissionFile: null,
    score: null,
    feedback: null,
  },
  {
    id: "as2",
    classId: "it321",
    title: "CIA Triad Reflection Paper",
    instructions: "Write a one-page reflection on how the CIA triad applies to a system you use daily. Late submissions are not accepted.",
    dueAt: hoursFromNow(-20),
    points: 10,
    allowLate: false,
    attachments: [],
    status: "assigned",
    submittedAt: null,
    submissionText: null,
    submissionFile: null,
    score: null,
    feedback: null,
  },
  {
    id: "as3",
    classId: "it321",
    title: "Quiz 1 Corrections",
    instructions: "Resubmit corrected answers for the 3 items you missed on Quiz 1.",
    dueAt: hoursFromNow(-200),
    points: 5,
    allowLate: true,
    attachments: [],
    status: "graded",
    submittedAt: hoursFromNow(-210),
    submissionText: "Corrections: Q4 confidentiality, Q7 symmetric key, Q12 IDS vs IPS.",
    submissionFile: null,
    score: 5,
    feedback: "All three corrections are accurate. Great work!",
  },
  {
    id: "as4",
    classId: "it314",
    title: "REST API Design Proposal",
    instructions: "Propose resource names and HTTP verbs for a simple library system API.",
    dueAt: hoursFromNow(50),
    points: 15,
    allowLate: true,
    attachments: [],
    status: "assigned",
    submittedAt: null,
    submissionText: null,
    submissionFile: null,
    score: null,
    feedback: null,
  },
  {
    id: "as5",
    classId: "it318",
    title: "Expo Project Setup",
    instructions: "Submit a screenshot of your running Expo app plus the GitHub repo link.",
    dueAt: hoursFromNow(72),
    points: 10,
    allowLate: true,
    attachments: [],
    status: "assigned",
    submittedAt: null,
    submissionText: null,
    submissionFile: null,
    score: null,
    feedback: null,
  },
];

class MockAssignmentRepository implements AssignmentRepository {
  listByClass(classId: string): Promise<Result<Assignment[]>> {
    return mockCall(() => ASSIGNMENTS.filter((a) => a.classId === classId).sort((a, b) => a.dueAt.localeCompare(b.dueAt)));
  }

  get(classId: string, id: string): Promise<Result<Assignment | null>> {
    return mockCall(() => ASSIGNMENTS.find((a) => a.classId === classId && a.id === id) ?? null);
  }

  async attach(
    classId: string,
    id: string,
    input: { text: string; file: Attachment | null },
  ): Promise<Result<Assignment>> {
    await new Promise((resolve) => setTimeout(resolve, 450));
    const current = ASSIGNMENTS.find((a) => a.classId === classId && a.id === id);
    if (!current) return fail(appError("not_found", "This assignment no longer exists."));
    if (current.status === "submitted" || current.status === "late" || current.status === "graded") {
      return fail(appError("conflict", "This was already turned in.", false));
    }

    const now = Date.now();
    const overdue = now > new Date(current.dueAt).getTime();
    const willSubmitNow = current.allowLate || !overdue;

    const next: Assignment = {
      ...current,
      submissionText: input.text || current.submissionText,
      submissionFile: input.file ?? current.submissionFile,
      status: willSubmitNow ? (overdue ? "late" : "submitted") : "draft",
      submittedAt: willSubmitNow ? new Date().toISOString() : null,
    };
    ASSIGNMENTS = ASSIGNMENTS.map((a) => (a.id === id ? next : a));
    return ok(next);
  }

  async turnIn(classId: string, id: string): Promise<Result<Assignment>> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const current = ASSIGNMENTS.find((a) => a.classId === classId && a.id === id);
    if (!current) return fail(appError("not_found", "This assignment no longer exists."));
    if (current.status !== "draft") return fail(appError("conflict", "Nothing to turn in.", false));
    const next: Assignment = { ...current, status: "submitted", submittedAt: new Date().toISOString() };
    ASSIGNMENTS = ASSIGNMENTS.map((a) => (a.id === id ? next : a));
    return ok(next);
  }
}

export const assignmentRepository: AssignmentRepository = new MockAssignmentRepository();
