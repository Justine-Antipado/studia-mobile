// assignment-submissions-repository.ts — instructor's view of who turned in an assignment.
// The list is the class roster LEFT-joined with submissions, so students who never started show
// up as "missing". Server rule (docs/api-contract.md): only the class owner may list or grade.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteAssignmentSubmissionRepository } from "@/features/instructor/data/assignment-submissions-remote";
import type { Attachment } from "@/features/instructor/types/instructor";

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

export const assignmentSubmissionRepository: AssignmentSubmissionRepository = new RemoteAssignmentSubmissionRepository();
