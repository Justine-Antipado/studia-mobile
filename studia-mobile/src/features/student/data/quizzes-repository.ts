// quizzes-repository.ts — student view. Quizzes are the instructor's rows (published only, enrolled
// classes only); an attempt submitted here is the row the instructor grades. Multiple choice and
// identification auto-grade on submit; essay points stay uncounted until the instructor grades the
// attempt, matching docs/UI-BRIEF grading rules.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteQuizRepository } from "@/features/student/data/quizzes-remote";
import type { Quiz, QuizAnswer, QuizAttempt } from "@/features/student/types/student";

/** What the server says about the attempt in progress: its clock, not the device's. */
export type QuizStart = { attemptId: string; secondsLeft: number | null };

export interface QuizRepository {
  listByClass(classId: string): Promise<Result<Quiz[]>>;
  get(classId: string, id: string): Promise<Result<Quiz | null>>;
  /**
   * Opens the attempt, or resumes the one already open, and returns the time left from the server.
   * The countdown used to be a module-level Map in the screen, so quitting the app handed out a
   * fresh full timer and the limit was never checked on submit (migration 033).
   */
  startAttempt(quizId: string): Promise<Result<QuizStart>>;
  submitAttempt(classId: string, quizId: string, answers: QuizAnswer[]): Promise<Result<QuizAttempt>>;
}

export const quizRepository: QuizRepository = new RemoteQuizRepository();
