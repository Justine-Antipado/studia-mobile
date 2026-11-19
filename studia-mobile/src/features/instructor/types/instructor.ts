// instructor.ts — shared domain types for every instructor feature. Repositories return
// these; screens never invent their own shape for the same data.
import type { Attachment, Comment } from "@/core/types/content";

// Attachment and Comment are identical on both sides of the app: declared in core/types.
export type { Attachment, AttachmentKind, Comment } from "@/core/types/content";

export type InstructorClass = {
  id: string;
  code: string; // subject code, e.g. "IT 321" — set by the instructor
  title: string;
  section: string;
  studentCount: number;
  joinCode: string; // auto-generated 6-char enrollment code
  archived: boolean;
};

export type ClassStudent = {
  id: string;
  name: string;
  email: string;
  section: string;
  progress: number; // 0..1
  submittedCount: number;
  pendingCount: number;
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

export type Material = {
  id: string;
  classId: string;
  title: string;
  kind: "video" | "pdf" | "slide";
  durationLabel: string | null;
  attachment: Attachment;
  processing: ProcessingState;
  transcript: TranscriptLine[];
  /** AI-extracted key learning objectives (mock AI core output). */
  objectives: string[];
  postedAt: string;
};

export type InstructorAssignment = {
  id: string;
  classId: string;
  title: string;
  instructions: string;
  dueAt: string;
  points: number;
  allowLate: boolean;
  attachments: Attachment[];
  createdAt: string;
};

export type BloomLevel = "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";
export type Difficulty = "Easy" | "Medium" | "Hard";
/** AI synthesizer produces multiple_choice only; manual create also supports the other two. */
export type QuizQuestionType = "multiple_choice" | "identification" | "essay";

export type QuizQuestion = {
  id: string;
  type: QuizQuestionType;
  text: string;
  options: string[] | null; // multiple_choice only, always 4 slots in the editor
  correctIndex: number | null; // multiple_choice only
  correctAnswer: string | null; // identification only; essay has no auto-grade so this stays null
  bloom: BloomLevel | null;
  difficulty: Difficulty | null;
  points: number;
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

export type EngagementPoint = { classCode: string; engagementPercent: number };
export type ContentConsumption = { title: string; classCode: string; viewRatePercent: number };
export type ConceptStruggle = { concept: string; classCode: string; missRatePercent: number };

export type AnalyticsData = {
  engagement: EngagementPoint[];
  consumption: ContentConsumption[];
  struggling: ConceptStruggle[];
};
