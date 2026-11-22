// quizzes-repository.ts — student view. Quizzes are the instructor's rows (published only, enrolled
// classes only); an attempt submitted here is the row the instructor grades. Multiple choice and
// identification auto-grade on submit; essay points stay uncounted until the instructor grades the
// attempt, matching docs/UI-BRIEF grading rules.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteQuizRepository } from "@/features/student/data/quizzes-remote";
import type { Quiz, QuizAnswer, QuizAttempt } from "@/features/student/types/student";

export interface QuizRepository {
  listByClass(classId: string): Promise<Result<Quiz[]>>;
  get(classId: string, id: string): Promise<Result<Quiz | null>>;
  submitAttempt(classId: string, quizId: string, answers: QuizAnswer[]): Promise<Result<QuizAttempt>>;
}

export const quizRepository: QuizRepository = new RemoteQuizRepository();
