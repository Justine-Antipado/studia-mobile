// assignments-repository.ts — student view of assignments. An assignment is the instructor's row;
// "my" submission is the student's row in assignment_submissions, so a turn-in here shows up in the
// instructor's Submissions list (and a grade shows up here).
// Late rule: allowLate=true -> submitting after dueAt is tagged "late". allowLate=false and
// already overdue -> a picked file is saved as a draft only. "Turn in" works once the instructor
// has extended the due date (submitted) or allowed late work (late); until then it is refused.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteAssignmentRepository } from "@/features/student/data/assignments-remote";
import type { Assignment, Attachment } from "@/features/student/types/student";

export interface AssignmentRepository {
  listByClass(classId: string): Promise<Result<Assignment[]>>;
  get(classId: string, id: string): Promise<Result<Assignment | null>>;
  /** Attach a file/text. May submit immediately, or save as a draft (see rule above). */
  attach(classId: string, id: string, input: { text: string; file: Attachment | null }): Promise<Result<Assignment>>;
  /** Turns in a previously attached draft. Only valid while status is "draft". */
  turnIn(classId: string, id: string): Promise<Result<Assignment>>;
}

export const assignmentRepository: AssignmentRepository = new RemoteAssignmentRepository();
