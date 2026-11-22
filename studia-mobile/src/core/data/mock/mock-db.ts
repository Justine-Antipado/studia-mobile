// mock-db.ts — ONE in-memory "database" shared by the student and instructor mock repositories.
// Before this, each role had its own copy of classes/assignments, so nothing an instructor did was
// visible to a student (and vice versa). The repositories are now thin role-specific VIEWS over
// these tables; the tables mirror the Supabase tables 1:1 so swapping to remote stays a one-file
// change per feature.
//
// Identity: mock mode always uses the DEMO users below (Juan = student, Maria = instructor). The
// "Switch view" button in Account (DEV) flips which one is "me" without resetting any data, which
// is how an end-to-end flow is tested: post as instructor -> switch -> see it as student.
//
// Counts (student count, progress, submitted/pending) are DERIVED from these tables, never typed.
import { seedAttempts, seedQuizzes } from "@/core/data/mock/mock-quiz-seed";
import { seedNotifications } from "@/core/data/mock/mock-notification-seed";
import { seedMaterials } from "@/core/data/mock/mock-material-seed";
import type { Attachment, VideoLink } from "@/core/types/content";

export type DbUser = { id: string; name: string; email: string; role: "student" | "instructor" };

export type DbClass = {
  id: string;
  code: string;
  title: string;
  section: string;
  ownerId: string;
  joinCode: string;
  archived: boolean;
};

export type DbAssignment = {
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

/** "draft" = attached but not turned in (late not allowed + overdue). Absent row = never started. */
export type DbSubmissionStatus = "draft" | "submitted" | "late" | "graded";

export type DbSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  status: DbSubmissionStatus;
  submittedAt: string | null;
  text: string | null;
  file: Attachment | null;
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
};

export type DbAnnouncement = {
  id: string;
  classId: string;
  authorId: string;
  title: string;
  body: string;
  postedAt: string;
  pinned: boolean;
};

export type DbComment = {
  id: string;
  announcementId: string;
  authorId: string;
  text: string;
  postedAt: string;
};

export type DbQuestion = {
  id: string;
  type: "multiple_choice" | "identification" | "essay";
  prompt: string;
  options: string[] | null;
  correctIndex: number | null;
  correctAnswer: string | null;
  bloom: "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create" | null;
  difficulty: "Easy" | "Medium" | "Hard" | null;
  points: number;
  rationale: string | null;
};

export type DbQuiz = {
  id: string;
  classId: string;
  title: string;
  status: "draft" | "published";
  source: "manual" | "ai";
  timeLimitMin: number | null;
  dueAt: string | null;
  /** Last moment a late attempt is accepted (only meaningful when allowLate). */
  closesAt: string | null;
  allowLate: boolean;
  createdAt: string;
  questions: DbQuestion[];
};

/** One row per (quiz, student). The auto score is computed on read; only an instructor sets gradedScore. */
export type DbAttempt = {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: string;
  submittedAt: string;
  /** Submitted after the due date (only possible when the quiz allows late attempts). */
  late: boolean;
  answers: { questionId: string; response: string | number | null }[];
  gradedScore: number | null;
  feedback: string | null;
  gradedAt: string | null;
};

export type DbTranscriptLine = { id: string; startSec: number; text: string };

/** A lesson/material. A video is a LINK (`link` set, `attachment` null); other kinds are uploads. */
export type DbMaterial = {
  id: string;
  classId: string;
  title: string;
  kind: "video" | "pdf" | "slide";
  link: VideoLink | null;
  attachment: Attachment | null;
  durationLabel: string | null;
  processing: "processing" | "ready" | "failed";
  transcript: DbTranscriptLine[];
  objectives: string[];
  aiSummary: { tldr: string; bullets: string[] } | null;
  /** How many times the summary was regenerated (capped: AI calls cost money). */
  summaryRegens: number;
  postedAt: string;
};

export type NotificationTag = "Notice" | "Quiz" | "Grade" | "Lesson" | "Class" | "AI" | "Reminder";

export type DbNotification = {
  id: string;
  userId: string;
  tag: NotificationTag;
  title: string;
  meta: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
};

/** One study plan per student (rolling 7-day window starting at `startIso`). */
export type DbPlannerBlock = {
  id: string;
  dayIso: string;
  startHour: number;
  durationHours: number;
  title: string;
  taskId: string | null;
  done: boolean;
};
export type DbExam = { id: string; title: string; dateIso: string };
export type DbPlanner = {
  startIso: string;
  blocks: DbPlannerBlock[];
  exams: DbExam[];
  /** Bumped by Regenerate so the new plan is arranged differently. */
  generation: number;
};

export const ME = { student: "u_juan", instructor: "u_maria" } as const;

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const STUDENT_NAMES = [
  "Juan Dela Cruz",
  "Ana Villanueva",
  "Mark Bautista",
  "Liza Mercado",
  "Carlo Dizon",
  "Rica Santiago",
  "Kristine Bautista",
  "Paolo Mendoza",
  "Jasmine Ramos",
  "Angelica Flores",
];

function seedUsers(): DbUser[] {
  const students: DbUser[] = STUDENT_NAMES.map((name, i) => ({
    id: i === 0 ? ME.student : `u_s${i}`,
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@omsc.edu.ph`,
    role: "student",
  }));
  return [
    { id: ME.instructor, name: "Maria Santos", email: "maria.santos@omsu.edu.ph", role: "instructor" },
    { id: "u_ramon", name: "Ramon Reyes", email: "ramon.reyes@omsu.edu.ph", role: "instructor" },
    { id: "u_jose", name: "Jose Cruz", email: "jose.cruz@omsu.edu.ph", role: "instructor" },
    ...students,
  ];
}

function seedClasses(): DbClass[] {
  const c = (id: string, code: string, title: string, section: string, ownerId: string, joinCode: string): DbClass => ({
    id, code, title, section, ownerId, joinCode, archived: false,
  });
  return [
    c("it321", "IT 321", "Information Assurance and Security", "BSIT 3-A", ME.instructor, "K7P9QX"),
    c("it314", "IT 314", "Web Systems and Technologies", "BSIT 3-A", ME.instructor, "M2D8LA"),
    c("it318", "IT 318", "Mobile Application Development", "BSIT 3-A", ME.instructor, "R5T3ZB"),
    c("it322", "IT 322", "Systems Integration and Architecture", "BSIT 4-A", ME.instructor, "W9C4NH"),
    // Owned by another teacher: Juan sees it, Maria does not.
    c("ge105", "GE 105", "Purposive Communication", "BSIT 3-A", "u_jose", "H4F6WT"),
  ];
}

/** [classId, studentIds...]. Juan is in every BSIT 3-A class but not IT 322 (4th-year section). */
function seedEnrollments(): { classId: string; studentId: string }[] {
  const all = Array.from({ length: 10 }, (_, i) => (i === 0 ? ME.student : `u_s${i}`));
  const rows: { classId: string; studentId: string }[] = [];
  for (const classId of ["it321", "it314", "it318", "ge105"]) all.forEach((studentId) => rows.push({ classId, studentId }));
  all.slice(1, 6).forEach((studentId) => rows.push({ classId: "it322", studentId }));
  return rows;
}

function seedAssignments(): DbAssignment[] {
  return [
    {
      id: "as1",
      classId: "it321",
      title: "Firewall Rule Design Exercise",
      instructions: "Design an iptables-style rule set for a small office network (1 server, 10 workstations). Submit as a PDF.",
      dueAt: hoursFromNow(30),
      points: 20,
      allowLate: true,
      attachments: [{ id: "ia1", name: "Exercise_Brief.pdf", kind: "pdf", sizeLabel: "420 KB" }],
      createdAt: hoursFromNow(-48),
    },
    {
      id: "as2",
      classId: "it321",
      title: "CIA Triad Reflection Paper",
      instructions: "Write a one-page reflection on how the CIA triad applies to a system you use daily. Late submissions are not accepted.",
      dueAt: hoursFromNow(-20),
      points: 10,
      allowLate: false,
      attachments: [],
      createdAt: hoursFromNow(-96),
    },
    {
      id: "as3",
      classId: "it321",
      title: "Quiz 1 Corrections",
      instructions: "Resubmit corrected answers for the 3 items you missed on Quiz 1.",
      dueAt: hoursFromNow(-200),
      points: 5,
      allowLate: true,
      attachments: [],
      createdAt: hoursFromNow(-300),
    },
    {
      id: "as4",
      classId: "it314",
      title: "REST API Design Proposal",
      instructions: "Propose resource names and HTTP verbs for a simple library system API.",
      dueAt: hoursFromNow(50),
      points: 15,
      allowLate: true,
      attachments: [],
      createdAt: hoursFromNow(-24),
    },
    {
      id: "as5",
      classId: "it318",
      title: "Expo Project Setup",
      instructions: "Submit a screenshot of your running Expo app plus the GitHub repo link.",
      dueAt: hoursFromNow(72),
      points: 10,
      allowLate: true,
      attachments: [],
      createdAt: hoursFromNow(-12),
    },
  ];
}

function seedSubmissions(): DbSubmission[] {
  const sub = (
    id: string,
    assignmentId: string,
    studentId: string,
    status: DbSubmissionStatus,
    hoursAgo: number,
    extra: Partial<DbSubmission> = {},
  ): DbSubmission => ({
    id,
    assignmentId,
    studentId,
    status,
    submittedAt: status === "draft" ? null : hoursFromNow(-hoursAgo),
    text: "Submitted work.",
    file: null,
    score: null,
    feedback: null,
    gradedAt: null,
    ...extra,
  });
  return [
    // as3 (Quiz 1 Corrections): Juan graded; others in various states
    sub("sb1", "as3", ME.student, "graded", 210, {
      text: "Corrections: Q4 confidentiality, Q7 symmetric key, Q12 IDS vs IPS.",
      score: 5,
      feedback: "All three corrections are accurate. Great work!",
      gradedAt: hoursFromNow(-190),
    }),
    sub("sb2", "as3", "u_s1", "graded", 220, { score: 4, feedback: "Q7 needs more detail.", gradedAt: hoursFromNow(-190) }),
    sub("sb3", "as3", "u_s2", "submitted", 205),
    sub("sb4", "as3", "u_s3", "late", 150),
    // as2 (overdue, no late): one on-time submission, one draft, Juan has nothing
    sub("sb5", "as2", "u_s1", "submitted", 30),
    sub("sb6", "as2", "u_s2", "draft", 0),
    // as1 (open): a couple already turned in
    sub("sb7", "as1", "u_s1", "submitted", 6),
    sub("sb8", "as1", "u_s4", "submitted", 3),
    // as4
    sub("sb9", "as4", "u_s2", "submitted", 2),
  ];
}

const minutesAgo = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

function seedAnnouncements(): DbAnnouncement[] {
  const a = (id: string, classId: string, title: string, body: string, ago: number, pinned: boolean): DbAnnouncement => ({
    id, classId, authorId: ME.instructor, title, body, postedAt: minutesAgo(ago), pinned,
  });
  return [
    a("an1", "it321", "Midterm exam schedule", "Our midterm exam is on Nov 10-14, 2026. Coverage: Lessons 1-5 (CIA triad, firewalls, IDS, access control, cryptography basics). Bring your own calculator.", 60 * 6, true),
    a("an2", "it321", "Lesson 3 slides updated", "I fixed a typo on slide 14 (symmetric vs asymmetric encryption). Please re-download before reviewing.", 60 * 30, false),
    a("an3", "it314", "Lesson 6: REST APIs is up", "Covers resource naming, status codes and the request/response cycle. Quiz 3 will draw from this.", 90, false),
    a("an4", "it318", "Welcome to Mobile Application Development", "We will build an Expo app together this term. Install Expo Go on your phone before our next meeting.", 60 * 48, true),
  ];
}

function seedComments(): DbComment[] {
  return [
    { id: "c1", announcementId: "an1", authorId: "u_s1", text: "Is this open book, Prof?", postedAt: minutesAgo(60 * 5) },
    { id: "c2", announcementId: "an1", authorId: ME.instructor, text: "Closed book, but you may bring one index card of notes.", postedAt: minutesAgo(60 * 4) },
    { id: "c3", announcementId: "an3", authorId: "u_s2", text: "Will there be a hands-on lab?", postedAt: minutesAgo(60) },
  ];
}

type Listener = () => void;


class MockDb {
  users: DbUser[] = seedUsers();
  classes: DbClass[] = seedClasses();
  enrollments = seedEnrollments();
  assignments: DbAssignment[] = seedAssignments();
  submissions: DbSubmission[] = seedSubmissions();
  announcements: DbAnnouncement[] = seedAnnouncements();
  comments: DbComment[] = seedComments();
  quizzes: DbQuiz[] = seedQuizzes();
  attempts: DbAttempt[] = seedAttempts();
  materials: DbMaterial[] = seedMaterials();
  notifications: DbNotification[] = seedNotifications();
  /** studentId -> plan. Created on first use; cleared by reset(). */
  planners: Record<string, DbPlanner> = {};
  private listeners = new Set<Listener>();

  /** Called by DEV tools; restores the seed without touching the session. */
  reset() {
    this.users = seedUsers();
    this.classes = seedClasses();
    this.enrollments = seedEnrollments();
    this.assignments = seedAssignments();
    this.submissions = seedSubmissions();
    this.announcements = seedAnnouncements();
    this.comments = seedComments();
    this.quizzes = seedQuizzes();
    this.attempts = seedAttempts();
    this.materials = seedMaterials();
    this.notifications = seedNotifications();
    this.planners = {};
    this.emit();
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  emit() {
    this.listeners.forEach((l) => l());
  }

  /* ---------- selectors (all counts are derived) ---------- */

  user(id: string) {
    return this.users.find((u) => u.id === id);
  }

  cls(id: string) {
    return this.classes.find((c) => c.id === id);
  }

  studentsOf(classId: string): DbUser[] {
    return this.enrollments
      .filter((e) => e.classId === classId)
      .map((e) => this.user(e.studentId))
      .filter((u): u is DbUser => !!u);
  }

  isEnrolled(classId: string, studentId: string) {
    return this.enrollments.some((e) => e.classId === classId && e.studentId === studentId);
  }

  classesOfStudent(studentId: string): DbClass[] {
    return this.classes.filter((c) => !c.archived && this.isEnrolled(c.id, studentId));
  }

  assignmentsOf(classId: string) {
    return this.assignments.filter((a) => a.classId === classId);
  }

  submissionOf(assignmentId: string, studentId: string) {
    return this.submissions.find((s) => s.assignmentId === assignmentId && s.studentId === studentId);
  }

  /** Turned-in = submitted | late | graded (a draft is not turned in). */
  isTurnedIn(s: DbSubmission | undefined) {
    return !!s && s.status !== "draft";
  }

  /** Share of the class's assignments this student has turned in (0..1). */
  progressOf(classId: string, studentId: string): number {
    const list = this.assignmentsOf(classId);
    if (list.length === 0) return 0;
    const done = list.filter((a) => this.isTurnedIn(this.submissionOf(a.id, studentId))).length;
    return done / list.length;
  }
}

export const mockDb = new MockDb();

let seq = 0;
export const dbId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;
