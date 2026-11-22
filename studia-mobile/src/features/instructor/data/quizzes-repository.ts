// quizzes-repository.ts — manual + AI-synthesized quizzes. A published quiz appears in the students'
// course Tasks; drafts never do. The server enforces the schedule rules and locks the questions once
// any student has submitted.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteInstructorQuizRepository } from "@/features/instructor/data/quizzes-remote";
import type { Quiz, QuizDraft } from "@/features/instructor/types/instructor";

export interface QuizRepository {
  list(): Promise<Result<Quiz[]>>;
  listByClass(classId: string): Promise<Result<Quiz[]>>;
  get(id: string): Promise<Result<Quiz | null>>;
  create(draft: QuizDraft, publish: boolean): Promise<Result<Quiz>>;
  update(id: string, draft: QuizDraft, publish: boolean): Promise<Result<Quiz>>;
  remove(id: string): Promise<Result<void>>;
}

export const quizRepository: QuizRepository = new RemoteInstructorQuizRepository();
