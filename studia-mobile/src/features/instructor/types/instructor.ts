export type ClassSummary = {
  id: string;
  code: string;
  section: string;
  title: string;
  students: number;
};

export type QuizQuestion = {
  id: string;
  text: string;
  options: string[]; // always 4 slots in the editor
  correctIndex: number;
};

export type QuizStatus = "draft" | "published";

export type Quiz = {
  id: string;
  title: string;
  classId: string;
  classCode: string;
  questions: QuizQuestion[];
  status: QuizStatus;
  source: "manual" | "ai";
  createdAt: string; // ISO
};

export type QuizDraft = {
  title: string;
  classId: string | null;
  questions: QuizQuestion[];
  source: Quiz["source"];
};

export type Submission = {
  id: string;
  studentName: string;
  classCode: string;
  quizId: string;
  quizTitle: string;
  submittedAt: string; // ISO
  maxScore: number;
  score: number | null; // null = not graded yet
  gradedAt: string | null;
  feedback: string;
  answers: { prompt: string; response: string }[];
};

export type Failure = { ok: false; error: string };
export type Result = { ok: true } | Failure;

export type GradingGroup = {
  quizId: string;
  quizTitle: string;
  classCode: string;
  count: number;
  oldestAt: string;
};

export type InstructorStats = {
  classCount: number;
  studentCount: number;
  pendingCount: number;
  nextGrading: GradingGroup | null;
};
