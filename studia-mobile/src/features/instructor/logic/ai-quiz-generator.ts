// ai-quiz-generator.ts — Bloom's-taxonomy quiz synthesizer. The questions are written by studia-api
// (api/ai/quiz), which holds the AI key; the app only reviews and saves them. Multiple Choice only,
// each item tagged with a Bloom level and difficulty (docs/UI-BRIEF).
import { z } from "zod";

import { callAi } from "@/core/data/supabase/ai-api";
import type { BloomLevel, Difficulty, QuizQuestion } from "@/features/instructor/types/instructor";
import { newId } from "@/shared/utils/id";

export type GenerateParams = { topic: string; count: number; difficulty: Difficulty };

const Reply = z.object({
  questions: z.array(
    z.object({
      text: z.string(),
      options: z.array(z.string()).length(4),
      correctIndex: z.number().int().min(0).max(3),
      bloom: z.enum(["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]),
    }),
  ),
});

/** Rejects with an Error whose message is safe to show to the instructor. */
export async function generateQuiz({ topic, count, difficulty }: GenerateParams): Promise<QuizQuestion[]> {
  const res = await callAi("quiz", { topic, count, difficulty }, Reply);
  if (!res.ok) throw new Error(res.error.message);
  return res.value.questions.map((q) => ({
    id: newId("q"),
    type: "multiple_choice" as const,
    text: q.text,
    options: q.options,
    correctIndex: q.correctIndex,
    correctAnswer: null,
    bloom: q.bloom as BloomLevel,
    difficulty,
    points: 1,
  }));
}
