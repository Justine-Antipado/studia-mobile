// submissions-repository.ts — quiz submissions: grade, feedback, gradebook source of truth.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import { parseScore } from "@/features/instructor/logic/quiz-validation";
import type { Submission } from "@/features/instructor/types/instructor";

export interface SubmissionRepository {
  list(): Promise<Result<Submission[]>>;
  listByQuiz(quizId: string): Promise<Result<Submission[]>>;
  get(id: string): Promise<Result<Submission | null>>;
  grade(id: string, scoreInput: string, feedback: string): Promise<Result<Submission>>;
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const QUIZ2_QA = [
  { prompt: "Explain the CIA triad in your own words.", response: "Confidentiality, integrity and availability: keep data private, correct, and reachable." },
  { prompt: "Give one threat and a matching control.", response: "Phishing is reduced with user training and multi-factor authentication." },
  { prompt: "Why is defense in depth recommended?", response: "One control can fail, so layered controls limit the damage." },
];

const pendingNames = [
  "Juan Dela Cruz", "Ana Reyes", "Mark Villanueva", "Kristine Bautista",
  "Paolo Mendoza", "Jasmine Ramos", "Carlo Navarro", "Angelica Flores",
  "Rafael Santiago", "Bea Castillo", "Miguel Aquino", "Trisha Gonzales",
];

const pending: Submission[] = pendingNames.map((name, i) => ({
  id: `isub_it321_2_${i}`,
  studentName: name,
  classCode: "IT 321",
  quizId: "quiz_it321_2",
  quizTitle: "Quiz 2: Network Security",
  submittedAt: ago(30 + i * 45),
  maxScore: 20,
  score: null,
  gradedAt: null,
  feedback: "",
  answers: QUIZ2_QA,
}));

const graded = (
  id: string, name: string, code: string, quizId: string, quizTitle: string, score: number, minAgo: number,
): Submission => ({
  id, studentName: name, classCode: code, quizId, quizTitle,
  submittedAt: ago(minAgo + 120), maxScore: 20, score, gradedAt: ago(minAgo), feedback: "", answers: [],
});

let SUBMISSIONS: Submission[] = [
  ...pending,
  graded("ig1", "Liza Manalo", "IT 321", "quiz_it321_1", "Quiz 1: CIA Triad", 18, 60 * 24 * 12),
  graded("ig2", "Noel Pascual", "IT 321", "quiz_it321_1", "Quiz 1: CIA Triad", 15, 60 * 24 * 12),
  graded("ig3", "Rica Salvador", "IT 321", "quiz_it321_1", "Quiz 1: CIA Triad", 11, 60 * 24 * 12),
  graded("ig4", "Dennis Lopez", "IT 314", "quiz_it314_1", "Quiz 1: REST APIs", 19, 60 * 24 * 9),
  graded("ig5", "Mia Cortez", "IT 314", "quiz_it314_1", "Quiz 1: REST APIs", 16, 60 * 24 * 9),
  graded("ig6", "Joel Tan", "IT 314", "quiz_it314_1", "Quiz 1: REST APIs", 9, 60 * 24 * 9),
];

class MockSubmissionRepository implements SubmissionRepository {
  list(): Promise<Result<Submission[]>> {
    return mockCall(() => [...SUBMISSIONS]);
  }

  listByQuiz(quizId: string): Promise<Result<Submission[]>> {
    return mockCall(() => SUBMISSIONS.filter((s) => s.quizId === quizId));
  }

  get(id: string): Promise<Result<Submission | null>> {
    return mockCall(() => SUBMISSIONS.find((s) => s.id === id) ?? null);
  }

  async grade(id: string, scoreInput: string, feedback: string): Promise<Result<Submission>> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const sub = SUBMISSIONS.find((s) => s.id === id);
    if (!sub) return fail(appError("not_found", "This submission no longer exists."));
    const parsed = parseScore(scoreInput, sub.maxScore);
    if (!parsed.ok) return fail(appError("validation", parsed.error, false));
    const next: Submission = { ...sub, score: parsed.value, feedback: feedback.trim(), gradedAt: new Date().toISOString() };
    SUBMISSIONS = SUBMISSIONS.map((s) => (s.id === id ? next : s));
    return ok(next);
  }
}

export const submissionRepository: SubmissionRepository = new MockSubmissionRepository();
