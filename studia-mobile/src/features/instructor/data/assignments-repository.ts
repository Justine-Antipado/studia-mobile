// assignments-repository.ts — instructor-authored assignments: create, edit, delete.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteInstructorAssignmentRepository } from "@/features/instructor/data/assignments-remote";
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

export const instructorAssignmentRepository: InstructorAssignmentRepository = new RemoteInstructorAssignmentRepository();
