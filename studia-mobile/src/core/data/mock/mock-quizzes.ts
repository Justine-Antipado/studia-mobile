// mock-quizzes.ts — scoring and visibility rules for quizzes + attempts over the mock DB.
//   - MC and identification are auto-scored; essay points are NOT counted until the instructor
//     grades the attempt (then `gradedScore` is the final total).
//   - An attempt "needs grading" while it has an essay question and no gradedScore.
//   - Students only ever see published quizzes of classes they are enrolled in.
//   - Only the class owner lists attempts or grades them.
import { dbId, mockDb, type DbAttempt, type DbQuiz } from "@/core/data/mock/mock-db";
import { isOwner } from "@/core/data/mock/mock-announcements";
import { classCodeOf, nameOf, notify, ownerOf } from "@/core/data/mock/mock-notifications";

export const maxScoreOf = (q: DbQuiz) => q.questions.reduce((n, x) => n + x.points, 0);

export function autoScore(quiz: DbQuiz, answers: DbAttempt["answers"]): number {
  let score = 0;
  for (const q of quiz.questions) {
    const given = answers.find((a) => a.questionId === q.id)?.response;
    if (q.type === "multiple_choice" && given === q.correctIndex) score += q.points;
    if (q.type === "identification" && typeof given === "string" && q.correctAnswer) {
      if (given.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) score += q.points;
    }
  }
  return score;
}

export const hasEssay = (quiz: DbQuiz) => quiz.questions.some((q) => q.type === "essay");

export const needsGrading = (quiz: DbQuiz, a: DbAttempt) => hasEssay(quiz) && a.gradedScore === null;

/** The score to show: the instructor's total if set, otherwise the auto score. */
export const finalScore = (quiz: DbQuiz, a: DbAttempt) => a.gradedScore ?? autoScore(quiz, a.answers);

export const attemptOf = (quizId: string, studentId: string) =>
  mockDb.attempts.find((a) => a.quizId === quizId && a.studentId === studentId);

export function visibleToStudent(classId: string, studentId: string): DbQuiz[] {
  if (!mockDb.isEnrolled(classId, studentId)) return [];
  return mockDb.quizzes.filter((q) => q.classId === classId && q.status === "published");
}

export function ownedQuizzes(ownerId: string): DbQuiz[] {
  return mockDb.quizzes.filter((q) => isOwner(q.classId, ownerId));
}

export type SubmitWindow = "open" | "late" | "closed";

/**
 * open   = before the due date (or no due date)
 * late   = after due, late attempts allowed and `closesAt` (if any) not reached
 * closed = after due and late not allowed, or after `closesAt`
 * The server decides this from ITS clock; the client only displays it.
 */
export function submitWindow(quiz: DbQuiz, now = Date.now()): SubmitWindow {
  if (!quiz.dueAt || now <= new Date(quiz.dueAt).getTime()) return "open";
  if (!quiz.allowLate) return "closed";
  if (quiz.closesAt && now > new Date(quiz.closesAt).getTime()) return "closed";
  return "late";
}

export function submitAttempt(quiz: DbQuiz, studentId: string, answers: DbAttempt["answers"]): DbAttempt {
  const now = new Date().toISOString();
  const attempt: DbAttempt = {
    id: dbId("att"),
    quizId: quiz.id,
    studentId,
    startedAt: now,
    submittedAt: now,
    late: submitWindow(quiz) === "late",
    answers,
    gradedScore: null,
    feedback: null,
    gradedAt: null,
  };
  mockDb.attempts = [...mockDb.attempts, attempt];
  mockDb.emit();
  const owner = ownerOf(quiz.classId);
  if (owner) {
    notify([owner], {
      tag: "Grade",
      title: `${nameOf(studentId)} submitted ${quiz.title}`,
      meta: `${classCodeOf(quiz.classId)}${attempt.late ? " · Late" : ""}${hasEssay(quiz) ? " · Needs grading" : ""}`,
    });
  }
  return attempt;
}
