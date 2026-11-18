import { useMemo, useSyncExternalStore } from "react";

import { INSTRUCTOR_CLASSES } from "@/core/data/mock/mock-data";
import { newId } from "@/features/instructor/logic/format";
import { parseScore, validateQuizDraft } from "@/features/instructor/logic/quiz-validation";
import type {
  ClassSummary,
  GradingGroup,
  InstructorStats,
  Quiz,
  QuizDraft,
  Result,
  Submission,
} from "@/features/instructor/types/instructor";

/**
 * Single data entry point for the instructor screens.
 * In-memory for now (resets on app restart).
 * TODO: back these actions with the api-client / PHP backend.
 */

// ---- classes (normalized once so ids are always strings) -------------------
const CLASSES: ClassSummary[] = INSTRUCTOR_CLASSES.map((c) => ({
  id: String(c.id),
  code: String(c.code),
  section: String(c.section),
  title: String(c.title),
  students: Number(c.students) || 0,
}));

// ---- seed -------------------------------------------------------------------
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const classIdOf = (code: string) => CLASSES.find((c) => c.code === code)?.id ?? "";

const QUIZ2_QA = [
  { prompt: "Explain the CIA triad in your own words.", response: "Confidentiality, integrity and availability: keep data private, correct, and reachable." },
  { prompt: "Give one threat and a matching control.", response: "Phishing is reduced with user training and multi-factor authentication." },
  { prompt: "Why is defense in depth recommended?", response: "One control can fail, so layered controls limit the damage." },
];

function seed(): { quizzes: Quiz[]; submissions: Submission[] } {
  const quizzes: Quiz[] = [
    { id: "quiz_it321_1", title: "Quiz 1", classId: classIdOf("IT 321"), classCode: "IT 321", questions: [], status: "published", source: "manual", createdAt: ago(60 * 24 * 14) },
    { id: "quiz_it321_2", title: "Quiz 2", classId: classIdOf("IT 321"), classCode: "IT 321", questions: [], status: "published", source: "manual", createdAt: ago(60 * 24 * 3) },
    { id: "quiz_it314_1", title: "Quiz 1", classId: classIdOf("IT 314"), classCode: "IT 314", questions: [], status: "published", source: "manual", createdAt: ago(60 * 24 * 10) },
  ];

  const pendingNames = [
    "Juan Dela Cruz", "Ana Reyes", "Mark Villanueva", "Kristine Bautista",
    "Paolo Mendoza", "Jasmine Ramos", "Carlo Navarro", "Angelica Flores",
    "Rafael Santiago", "Bea Castillo", "Miguel Aquino", "Trisha Gonzales",
  ];
  const pending: Submission[] = pendingNames.map((name, i) => ({
    id: `sub_it321_2_${i}`,
    studentName: name,
    classCode: "IT 321",
    quizId: "quiz_it321_2",
    quizTitle: "Quiz 2",
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

  const done: Submission[] = [
    graded("g1", "Liza Manalo", "IT 321", "quiz_it321_1", "Quiz 1", 18, 60 * 24 * 12),
    graded("g2", "Noel Pascual", "IT 321", "quiz_it321_1", "Quiz 1", 15, 60 * 24 * 12),
    graded("g3", "Rica Salvador", "IT 321", "quiz_it321_1", "Quiz 1", 11, 60 * 24 * 12),
    graded("g4", "Dennis Lopez", "IT 314", "quiz_it314_1", "Quiz 1", 19, 60 * 24 * 9),
    graded("g5", "Mia Cortez", "IT 314", "quiz_it314_1", "Quiz 1", 16, 60 * 24 * 9),
    graded("g6", "Joel Tan", "IT 314", "quiz_it314_1", "Quiz 1", 9, 60 * 24 * 9),
  ];

  return { quizzes, submissions: [...pending, ...done] };
}

// ---- tiny store (no extra dependency) ---------------------------------------
type StoreState = { quizzes: Quiz[]; submissions: Submission[] };

let state: StoreState = seed();
const listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => state;

function setState(next: StoreState) {
  state = next;
  listeners.forEach((l) => l());
}

function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ---- hooks -------------------------------------------------------------------
export const useInstructorClasses = (): ClassSummary[] => CLASSES;

export const useQuizzes = (): Quiz[] => useStore().quizzes;

export const useSubmissions = (): Submission[] => useStore().submissions;

export function useSubmission(id?: string): Submission | null {
  const { submissions } = useStore();
  return useMemo(() => submissions.find((s) => s.id === id) ?? null, [submissions, id]);
}

export function useInstructorStats(): InstructorStats {
  const { submissions } = useStore();
  return useMemo(() => {
    const groups = new Map<string, GradingGroup>();
    let pendingCount = 0;
    for (const s of submissions) {
      if (s.score !== null) continue;
      pendingCount++;
      const g = groups.get(s.quizId);
      if (!g) {
        groups.set(s.quizId, { quizId: s.quizId, quizTitle: s.quizTitle, classCode: s.classCode, count: 1, oldestAt: s.submittedAt });
      } else {
        g.count++;
        if (s.submittedAt < g.oldestAt) g.oldestAt = s.submittedAt;
      }
    }
    const nextGrading =
      Array.from(groups.values()).sort((a, b) => a.oldestAt.localeCompare(b.oldestAt))[0] ?? null;
    return {
      classCount: CLASSES.length,
      studentCount: CLASSES.reduce((n, c) => n + c.students, 0),
      pendingCount,
      nextGrading,
    };
  }, [submissions]);
}

// ---- actions -----------------------------------------------------------------
export function gradeSubmission(id: string, scoreInput: string, feedback: string): Result {
  const sub = state.submissions.find((s) => s.id === id);
  if (!sub) return { ok: false, error: "Submission not found." };
  const parsed = parseScore(scoreInput, sub.maxScore);
  if (!parsed.ok) return parsed;
  setState({
    ...state,
    submissions: state.submissions.map((s) =>
      s.id === id ? { ...s, score: parsed.value, feedback: feedback.trim(), gradedAt: new Date().toISOString() } : s,
    ),
  });
  return { ok: true };
}

export function addQuiz(draft: QuizDraft, publish: boolean): Result {
  const error = validateQuizDraft(draft, publish);
  if (error) return { ok: false, error };
  const cls = CLASSES.find((c) => c.id === draft.classId);
  if (!cls) return { ok: false, error: "Choose a class for this quiz." };
  const quiz: Quiz = {
    id: newId("quiz"),
    title: draft.title.trim(),
    classId: cls.id,
    classCode: cls.code,
    questions: draft.questions.map((q) => ({
      ...q,
      text: q.text.trim(),
      options: q.options.map((o) => o.trim()),
    })),
    status: publish ? "published" : "draft",
    source: draft.source,
    createdAt: new Date().toISOString(),
  };
  setState({ ...state, quizzes: [quiz, ...state.quizzes] });
  return { ok: true };
}
