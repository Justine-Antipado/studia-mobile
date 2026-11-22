// submissions-repository.ts — quiz attempts as the instructor sees them: grade, feedback, and the
// gradebook's source of truth. A view over the shared mock DB; `score` is null while an attempt
// still has an ungraded essay ("needs grading").
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { ME, mockDb, type DbAttempt, type DbQuiz } from "@/core/data/mock/mock-db";
import { classCodeOf, notify } from "@/core/data/mock/mock-notifications";
import { mockCall } from "@/core/data/mock/mock-latency";
import { finalScore, maxScoreOf, needsGrading, ownedQuizzes } from "@/core/data/mock/mock-quizzes";
import { parseScore } from "@/features/instructor/logic/quiz-validation";
import type { Submission } from "@/features/instructor/types/instructor";

export interface SubmissionRepository {
  list(): Promise<Result<Submission[]>>;
  listByQuiz(quizId: string): Promise<Result<Submission[]>>;
  get(id: string): Promise<Result<Submission | null>>;
  grade(id: string, scoreInput: string, feedback: string): Promise<Result<Submission>>;
}

function responseText(quiz: DbQuiz, a: DbAttempt, questionId: string): string {
  const q = quiz.questions.find((x) => x.id === questionId);
  const r = a.answers.find((x) => x.questionId === questionId)?.response;
  if (r === null || r === undefined || r === "") return "(no answer)";
  if (q?.type === "multiple_choice" && typeof r === "number") return q.options?.[r] ?? String(r);
  return String(r);
}

function toSubmission(quiz: DbQuiz, a: DbAttempt): Submission {
  const student = mockDb.user(a.studentId);
  const pending = needsGrading(quiz, a);
  return {
    id: a.id,
    studentName: student?.name ?? "Former student",
    classCode: mockDb.cls(quiz.classId)?.code ?? "",
    quizId: quiz.id,
    quizTitle: quiz.title,
    submittedAt: a.submittedAt,
    maxScore: maxScoreOf(quiz),
    score: pending ? null : finalScore(quiz, a),
    gradedAt: a.gradedAt,
    feedback: a.feedback ?? "",
    late: a.late,
    // Only written answers need a human; MC/identification were scored automatically.
    answers: quiz.questions
      .filter((q) => q.type === "essay" || q.type === "identification")
      .map((q) => ({ prompt: q.prompt, response: responseText(quiz, a, q.id) })),
  };
}

function all(): Submission[] {
  const out: Submission[] = [];
  for (const quiz of ownedQuizzes(ME.instructor)) {
    for (const a of mockDb.attempts) if (a.quizId === quiz.id) out.push(toSubmission(quiz, a));
  }
  return out;
}

class MockSubmissionRepository implements SubmissionRepository {
  list(): Promise<Result<Submission[]>> {
    return mockCall(all);
  }

  listByQuiz(quizId: string): Promise<Result<Submission[]>> {
    return mockCall(() => all().filter((s) => s.quizId === quizId));
  }

  get(id: string): Promise<Result<Submission | null>> {
    return mockCall(() => all().find((s) => s.id === id) ?? null);
  }

  async grade(id: string, scoreInput: string, feedback: string): Promise<Result<Submission>> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const a = mockDb.attempts.find((x) => x.id === id);
    const quiz = a ? ownedQuizzes(ME.instructor).find((q) => q.id === a.quizId) : undefined;
    if (!a || !quiz) return fail(appError("not_found", "This submission no longer exists."));
    const parsed = parseScore(scoreInput, maxScoreOf(quiz));
    if (!parsed.ok) return fail(appError("validation", parsed.error, false));
    const next: DbAttempt = {
      ...a,
      gradedScore: parsed.value,
      feedback: feedback.trim() || null,
      gradedAt: new Date().toISOString(),
    };
    mockDb.attempts = mockDb.attempts.map((x) => (x.id === id ? next : x));
    mockDb.emit();
    notify([a.studentId], {
      tag: "Grade",
      title: `${quiz.title} graded`,
      meta: `You scored ${parsed.value}/${maxScoreOf(quiz)} · ${classCodeOf(quiz.classId)}`,
      body: next.feedback ?? undefined,
    });
    return ok(toSubmission(quiz, next));
  }
}

export const submissionRepository: SubmissionRepository = new MockSubmissionRepository();
