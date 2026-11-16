// lib/mock-data.ts  (replace with real API calls later)
import type { Role } from "@/services/auth-service";

/* ---------------- Instructor ---------------- */

export type ClassItem = {
  id: string;
  code: string;
  section: string;
  title: string;
  students: number;
  joinCode: string;
};

export const INSTRUCTOR_CLASSES: ClassItem[] = [
  { id: "it321", code: "IT 321", section: "BSIT 3-A", title: "Information Assurance and Security", students: 38, joinCode: "K7P9QX" },
  { id: "it314", code: "IT 314", section: "BSIT 3-B", title: "Web Systems and Technologies", students: 34, joinCode: "M2D8LA" },
  { id: "it318", code: "IT 318", section: "BSIT 3-C", title: "Mobile Application Development", students: 31, joinCode: "R5T3ZB" },
  { id: "it322", code: "IT 322", section: "BSIT 4-A", title: "Systems Integration", students: 25, joinCode: "W9C4NH" },
];

export const CLASS_STUDENTS = [
  { id: "s1", name: "Juan Dela Cruz", section: "BSIT 3-A", progress: 92 },
  { id: "s2", name: "Ana Villanueva", section: "BSIT 3-A", progress: 88 },
  { id: "s3", name: "Mark Bautista", section: "BSIT 3-A", progress: 76 },
  { id: "s4", name: "Liza Mercado", section: "BSIT 3-A", progress: 64 },
  { id: "s5", name: "Carlo Dizon", section: "BSIT 3-A", progress: 81 },
  { id: "s6", name: "Rica Santiago", section: "BSIT 3-A", progress: 95 },
];

export type QuizStatus = "to_grade" | "scheduled" | "graded" | "draft";

export const QUIZZES: { id: string; title: string; meta: string; status: QuizStatus; label: string; toGrade: number }[] = [
  { id: "q2", title: "Quiz 2: Network Security", meta: "IT 321 · 20 items · 38 submitted", status: "to_grade", label: "12 to grade", toGrade: 12 },
  { id: "mid", title: "Midterm Exam", meta: "IT 321 · Nov 10–14, 2026", status: "scheduled", label: "Scheduled", toGrade: 0 },
  { id: "q1", title: "Quiz 1: CIA Triad", meta: "IT 321 · Graded", status: "graded", label: "Graded", toGrade: 0 },
  { id: "q3", title: "Quiz 3: REST APIs", meta: "IT 314 · Draft", status: "draft", label: "Draft", toGrade: 0 },
];

/* ---------------- Student ---------------- */

export const STUDENT_COURSES = [
  { id: "it321", code: "IT 321", title: "Information Assurance and Security", teacher: "Prof. Maria Santos", progress: 0.7 },
  { id: "it314", code: "IT 314", title: "Web Systems and Technologies", teacher: "Prof. Ramon Reyes", progress: 0.45 },
  { id: "it318", code: "IT 318", title: "Mobile Application Development", teacher: "Prof. Ana Lim", progress: 0.3 },
  { id: "ge105", code: "GE 105", title: "Purposive Communication", teacher: "Prof. Jose Cruz", progress: 0.8 },
];

export type NotifKind = "announcement" | "quiz" | "lesson" | "grade" | "class";

export const NOTIFICATIONS: { id: string; kind: NotifKind; title: string; sub: string; unread: boolean; when: "Today" | "Earlier" }[] = [
  { id: "n1", kind: "announcement", title: "New announcement", sub: "Midterm exam Nov 10–14, 2026", unread: true, when: "Today" },
  { id: "n2", kind: "quiz", title: "Quiz 2 is due today", sub: "IT 321 · 5:00 PM", unread: true, when: "Today" },
  { id: "n3", kind: "lesson", title: "New lesson posted", sub: "IT 314 · Lesson 6: REST APIs", unread: false, when: "Today" },
  { id: "n4", kind: "grade", title: "Grade posted", sub: "IT 321 · Quiz 1: 18/20", unread: false, when: "Earlier" },
  { id: "n5", kind: "class", title: "Class joined", sub: "GE 105 · Purposive Communication", unread: false, when: "Earlier" },
];

/* ---------------- AI chat ---------------- */

export const CHAT_CONFIG: Record<Role, { subtitle: string; suggestions: string[]; seed: { id: string; from: "user" | "ai"; text: string }[] }> = {
  instructor: {
    subtitle: "Ask anything about your classes",
    suggestions: ["Lesson plan draft", "Quiz generation", "Class summary"],
    seed: [
      { id: "i1", from: "user", text: "Generate a rubric for the IT 321 midterm project" },
      { id: "i2", from: "ai", text: "Here is a 4-level rubric: Functionality 40%, Security design 30%, Documentation 20%, Presentation 10%." },
    ],
  },
  student: {
    subtitle: "Ask anything about your lessons",
    suggestions: ["Quiz me on…", "Plan my week", "Show my weak topics"],
    seed: [
      { id: "s1", from: "user", text: "Summarize Lesson 3" },
      { id: "s2", from: "ai", text: "Lesson 3 explains how firewalls, IDS and access control protect networks. The CIA triad guides every security decision." },
    ],
  },
};

/** Fake AI answer so the chat feels alive. Replace with your AI endpoint. */
export function mockReply(role: Role, question: string): string {
  const q = question.toLowerCase();
  if (q.includes("quiz")) {
    return role === "instructor"
      ? "Draft ready: 10 items on the CIA triad (5 multiple choice, 3 true or false, 2 identification). Want it added to Assessments?"
      : "Question 1: Which part of the CIA triad makes sure data is not changed without permission?";
  }
  if (q.includes("plan") || q.includes("lesson")) {
    return role === "instructor"
      ? "Lesson plan draft: 10 min recap, 25 min discussion on firewalls, 15 min hands-on lab, 10 min exit quiz."
      : "Mon: review Lesson 3. Tue: Quiz 2 prep. Wed: IT 314 REST APIs. Thu: practice questions. Fri: rest and recap.";
  }
  if (q.includes("weak")) return "You scored lowest on access control. I suggest re-reading Lesson 3 and taking a 5-item practice quiz.";
  if (q.includes("summary")) return "IT 321 · BSIT 3-A: average progress is 83%. Two students are below 70% and may need follow-up.";
  return "Got it. I can summarize lessons, draft quizzes, build a study plan or explain a topic. What would you like?";
}