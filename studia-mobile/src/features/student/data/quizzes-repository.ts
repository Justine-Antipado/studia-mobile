// quizzes-repository.ts — quiz taking + instant rationale. Multiple choice and identification
// auto-grade on submit; essay items are left ungraded (maxScore still counts their points) until
// the instructor grades them, matching docs/UI-BRIEF grading rules.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { Quiz, QuizAnswer, QuizAttempt } from "@/features/student/types/student";

export interface QuizRepository {
  listByClass(classId: string): Promise<Result<Quiz[]>>;
  get(classId: string, id: string): Promise<Result<Quiz | null>>;
  submitAttempt(classId: string, quizId: string, answers: QuizAnswer[]): Promise<Result<QuizAttempt>>;
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

let QUIZZES: Quiz[] = [
  {
    id: "qz1",
    classId: "it321",
    title: "Quiz 2: Network Security",
    timeLimitMin: 15,
    dueAt: hoursFromNow(28),
    questions: [
      {
        id: "q1", type: "multiple_choice",
        prompt: "Which part of the CIA triad ensures data is reachable when needed?",
        options: ["Confidentiality", "Integrity", "Availability", "Authentication"],
        correctIndex: 2, correctAnswer: null, bloom: "Remember", difficulty: "Easy", points: 2,
        rationale: "Availability specifically covers systems/data being reachable to authorized users.",
      },
      {
        id: "q2", type: "multiple_choice",
        prompt: "A device that filters traffic using IP, port and protocol rules is a:",
        options: ["IDS", "Firewall", "Proxy cache", "Load balancer"],
        correctIndex: 1, correctAnswer: null, bloom: "Understand", difficulty: "Easy", points: 2,
        rationale: "Firewalls apply rule sets to allow or block traffic by IP/port/protocol.",
      },
      {
        id: "q3", type: "identification",
        prompt: "What do you call a system that monitors traffic and raises alerts on suspicious activity?",
        options: null, correctIndex: null, correctAnswer: "IDS", bloom: "Apply", difficulty: "Medium", points: 3,
        rationale: "An Intrusion Detection System (IDS) monitors and alerts; it does not block traffic.",
      },
      {
        id: "q4", type: "essay",
        prompt: "Explain why defense in depth is recommended over relying on a single control.",
        options: null, correctIndex: null, correctAnswer: null, bloom: "Evaluate", difficulty: "Hard", points: 5,
        rationale: "Model answer: no single control is perfect, so layered controls reduce the chance of total compromise.",
      },
    ],
    attempt: null,
  },
  {
    id: "qz2",
    classId: "it321",
    title: "Quiz 1: CIA Triad",
    timeLimitMin: 10,
    dueAt: hoursFromNow(-200),
    questions: [
      {
        id: "q5", type: "multiple_choice",
        prompt: "\"Only authorized people can read this file\" describes:",
        options: ["Confidentiality", "Integrity", "Availability", "Non-repudiation"],
        correctIndex: 0, correctAnswer: null, bloom: "Remember", difficulty: "Easy", points: 2,
        rationale: "Confidentiality restricts access to authorized parties only.",
      },
      {
        id: "q6", type: "multiple_choice",
        prompt: "A checksum mismatch after download suggests a problem with:",
        options: ["Confidentiality", "Integrity", "Availability", "Authorization"],
        correctIndex: 1, correctAnswer: null, bloom: "Apply", difficulty: "Medium", points: 2,
        rationale: "A changed checksum means the data was altered, which is an integrity failure.",
      },
    ],
    attempt: {
      id: "att1", quizId: "qz2", startedAt: hoursFromNow(-201), submittedAt: hoursFromNow(-200.8),
      answers: [{ questionId: "q5", response: 0 }, { questionId: "q6", response: 1 }],
      score: 4, maxScore: 4,
    },
  },
  {
    id: "qz3",
    classId: "it314",
    title: "Quiz 3: REST APIs",
    timeLimitMin: 12,
    dueAt: hoursFromNow(60),
    questions: [
      {
        id: "q7", type: "multiple_choice",
        prompt: "Which status code means the resource was created successfully?",
        options: ["200", "201", "400", "500"],
        correctIndex: 1, correctAnswer: null, bloom: "Remember", difficulty: "Easy", points: 2,
        rationale: "201 Created is returned after a successful POST that creates a resource.",
      },
    ],
    attempt: null,
  },
];

function autoScore(quiz: Quiz, answers: QuizAnswer[]): { score: number; maxScore: number } {
  let score = 0;
  let maxScore = 0;
  for (const q of quiz.questions) {
    maxScore += q.points;
    const given = answers.find((a) => a.questionId === q.id)?.response;
    if (q.type === "multiple_choice" && given === q.correctIndex) score += q.points;
    if (q.type === "identification" && typeof given === "string" && q.correctAnswer) {
      if (given.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) score += q.points;
    }
    // essay: left for the instructor to grade, not counted automatically.
  }
  return { score, maxScore };
}

class MockQuizRepository implements QuizRepository {
  listByClass(classId: string): Promise<Result<Quiz[]>> {
    return mockCall(() => QUIZZES.filter((q) => q.classId === classId));
  }

  get(classId: string, id: string): Promise<Result<Quiz | null>> {
    return mockCall(() => QUIZZES.find((q) => q.classId === classId && q.id === id) ?? null);
  }

  async submitAttempt(classId: string, quizId: string, answers: QuizAnswer[]): Promise<Result<QuizAttempt>> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const quiz = QUIZZES.find((q) => q.classId === classId && q.id === quizId);
    if (!quiz) return fail(appError("not_found", "This quiz is no longer available."));
    if (quiz.attempt) return fail(appError("conflict", "You already submitted this quiz.", false));

    const { score, maxScore } = autoScore(quiz, answers);
    const attempt: QuizAttempt = {
      id: newId("att"), quizId, startedAt: new Date().toISOString(), submittedAt: new Date().toISOString(),
      answers, score, maxScore,
    };
    QUIZZES = QUIZZES.map((q) => (q.id === quizId ? { ...q, attempt } : q));
    return ok(attempt);
  }
}

export const quizRepository: QuizRepository = new MockQuizRepository();
