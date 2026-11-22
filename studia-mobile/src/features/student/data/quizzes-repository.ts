// quizzes-repository.ts — student view over the shared mock DB. Quizzes are the instructor's rows
// (published only, enrolled classes only); an attempt submitted here is the row the instructor
// grades. Multiple choice and identification auto-grade on submit; essay points stay uncounted
// until the instructor grades the attempt, matching docs/UI-BRIEF grading rules.
import { isRemote } from "@/core/config/data-source";
import { RemoteQuizRepository } from "@/features/student/data/quizzes-remote";
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { ME, type DbAttempt, type DbQuiz } from "@/core/data/mock/mock-db";
import { mockCall } from "@/core/data/mock/mock-latency";
import { attemptOf, finalScore, maxScoreOf, submitAttempt, submitWindow, visibleToStudent } from "@/core/data/mock/mock-quizzes";
import type { Quiz, QuizAnswer, QuizAttempt } from "@/features/student/types/student";

export interface QuizRepository {
  listByClass(classId: string): Promise<Result<Quiz[]>>;
  get(classId: string, id: string): Promise<Result<Quiz | null>>;
  submitAttempt(classId: string, quizId: string, answers: QuizAnswer[]): Promise<Result<QuizAttempt>>;
}

function toAttempt(quiz: DbQuiz, a: DbAttempt | undefined): QuizAttempt | null {
  if (!a) return null;
  return {
    id: a.id,
    quizId: a.quizId,
    startedAt: a.startedAt,
    submittedAt: a.submittedAt,
    answers: a.answers,
    score: finalScore(quiz, a),
    maxScore: maxScoreOf(quiz),
  };
}

function toQuiz(q: DbQuiz): Quiz {
  return {
    id: q.id,
    classId: q.classId,
    title: q.title,
    timeLimitMin: q.timeLimitMin,
    dueAt: q.dueAt,
    closed: submitWindow(q) === "closed",
    allowLate: q.allowLate,
    questions: q.questions,
    attempt: toAttempt(q, attemptOf(q.id, ME.student)),
  };
}

class MockQuizRepository implements QuizRepository {
  listByClass(classId: string): Promise<Result<Quiz[]>> {
    return mockCall(() => visibleToStudent(classId, ME.student).map(toQuiz));
  }

  get(classId: string, id: string): Promise<Result<Quiz | null>> {
    return mockCall(() => {
      const q = visibleToStudent(classId, ME.student).find((x) => x.id === id);
      return q ? toQuiz(q) : null;
    });
  }

  async submitAttempt(classId: string, quizId: string, answers: QuizAnswer[]): Promise<Result<QuizAttempt>> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const quiz = visibleToStudent(classId, ME.student).find((q) => q.id === quizId);
    if (!quiz) return fail(appError("not_found", "This quiz is no longer available."));
    if (attemptOf(quizId, ME.student)) return fail(appError("conflict", "You already submitted this quiz.", false));
    if (submitWindow(quiz) === "closed") {
      return fail(appError("conflict", "This quiz is closed. It no longer accepts submissions.", false));
    }
    const attempt = submitAttempt(quiz, ME.student, answers);
    return ok(toAttempt(quiz, attempt)!);
  }
}

export const quizRepository: QuizRepository = isRemote ? new RemoteQuizRepository() : new MockQuizRepository();
