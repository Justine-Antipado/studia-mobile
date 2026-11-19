// student.ts — shared domain types for every student feature. Repositories return these;
// screens never invent their own shape for the same data.
import type { Attachment, Comment } from "@/core/types/content";

// Attachment and Comment are identical on both sides of the app: declared in core/types.
export type { Attachment, AttachmentKind, Comment } from "@/core/types/content";

export type Person = { id: string; name: string; role: "student" | "instructor" };

export type StudentClass = {
  id: string;
  code: string;
  title: string;
  section: string;
  teacher: string;
  progress: number; // 0..1
  joinCode: string;
};

export type Announcement = {
  id: string;
  classId: string;
  title: string;
  body: string;
  postedAt: string;
  pinned: boolean;
  comments: Comment[];
};

export type TranscriptLine = { id: string; startSec: number; text: string };
export type ProcessingState = "processing" | "ready" | "failed";

export type Lesson = {
  id: string;
  classId: string;
  title: string;
  kind: "video" | "pdf" | "slide";
  durationLabel: string | null;
  attachment: Attachment;
  processing: ProcessingState;
  transcript: TranscriptLine[];
  aiSummary: { tldr: string; bullets: string[] } | null;
  postedAt: string;
};

export type SubmissionStatus = "assigned" | "draft" | "submitted" | "late" | "graded";

export type Assignment = {
  id: string;
  classId: string;
  title: string;
  instructions: string;
  dueAt: string;
  points: number;
  allowLate: boolean;
  attachments: Attachment[];
  status: SubmissionStatus;
  submittedAt: string | null;
  submissionText: string | null;
  submissionFile: Attachment | null;
  score: number | null;
  feedback: string | null;
};

export type BloomLevel = "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type QuizQuestionType = "multiple_choice" | "identification" | "essay";

export type QuizQuestion = {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  options: string[] | null;
  correctIndex: number | null;
  /** Identification only; essay has no auto-grade so this stays null. */
  correctAnswer: string | null;
  bloom: BloomLevel | null;
  difficulty: Difficulty | null;
  points: number;
  rationale: string | null;
};

export type QuizAnswer = { questionId: string; response: string | number | null };

export type QuizAttempt = {
  id: string;
  quizId: string;
  startedAt: string;
  submittedAt: string | null;
  answers: QuizAnswer[];
  score: number | null;
  maxScore: number;
};

export type Quiz = {
  id: string;
  classId: string;
  title: string;
  timeLimitMin: number | null;
  dueAt: string | null;
  questions: QuizQuestion[];
  attempt: QuizAttempt | null;
};

export type TaskKind = "assignment" | "quiz";

export type Task = {
  id: string;
  kind: TaskKind;
  classId: string;
  classCode: string;
  refId: string;
  title: string;
  dueAt: string;
  done: boolean;
};

export type PlannerBlock = {
  id: string;
  dayIso: string;
  startHour: number;
  durationHours: number;
  title: string;
  taskId: string | null;
  done: boolean;
};

export type PlannerExam = { id: string; title: string; dateIso: string };

export type PlannerWeek = {
  weekStartIso: string;
  blocks: PlannerBlock[];
  exams: PlannerExam[];
};
