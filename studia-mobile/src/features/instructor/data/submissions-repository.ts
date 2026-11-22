// submissions-repository.ts — quiz attempts as the instructor sees them: grade, feedback, and the
// gradebook's source of truth. `score` is null while an attempt still has an ungraded essay.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteSubmissionRepository } from "@/features/instructor/data/submissions-remote";
import type { Submission } from "@/features/instructor/types/instructor";

export interface SubmissionRepository {
  list(): Promise<Result<Submission[]>>;
  listByQuiz(quizId: string): Promise<Result<Submission[]>>;
  get(id: string): Promise<Result<Submission | null>>;
  grade(id: string, scoreInput: string, feedback: string): Promise<Result<Submission>>;
}

export const submissionRepository: SubmissionRepository = new RemoteSubmissionRepository();
