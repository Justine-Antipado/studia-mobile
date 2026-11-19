// mock-data.ts — the last screen data that is not yet behind a repository.
// Classes, courses, notifications and every other list now come from
// features/<feature>/data/*-repository.ts; only the AI chat seed is still here.
import type { Role } from "@/core/types/role";

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