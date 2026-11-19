import type { QuizDraft, QuizQuestion } from "@/features/instructor/types/instructor";
import { newId } from "./format";

export const OPTION_LABELS = ["A", "B", "C", "D"] as const;

export const blankQuestion = (): QuizQuestion => ({
  id: newId("q"),
  text: "",
  options: ["", "", "", ""],
  correctIndex: 0,
});

/** Returns an error message, or null when valid. Drafts only need a title + class. */
export function validateQuizDraft(d: QuizDraft, publish: boolean): string | null {
  if (!d.title.trim()) return "Add a quiz title.";
  if (!d.classId) return "Choose a class for this quiz.";
  if (!publish) return null;
  if (d.questions.length === 0) return "Add at least one question.";
  for (let i = 0; i < d.questions.length; i++) {
    const q = d.questions[i];
    const n = i + 1;
    if (!q.text.trim()) return `Question ${n} needs text.`;
    const filled = q.options.filter((o) => o.trim()).length;
    if (filled < 2) return `Question ${n} needs at least 2 answer options.`;
    if (!q.options[q.correctIndex]?.trim())
      return `Question ${n}: the correct answer can't be empty.`;
  }
  return null;
}

export type ScoreParse = { ok: true; value: number } | { ok: false; error: string };

export function parseScore(input: string, max: number): ScoreParse {
  const raw = input.trim().replace(",", ".");
  if (!raw) return { ok: false, error: "Enter a score." };
  const value = Number(raw);
  if (!Number.isFinite(value)) return { ok: false, error: "Score must be a number." };
  if (value < 0 || value > max) return { ok: false, error: `Score must be between 0 and ${max}.` };
  return { ok: true, value: Math.round(value * 100) / 100 };
}
