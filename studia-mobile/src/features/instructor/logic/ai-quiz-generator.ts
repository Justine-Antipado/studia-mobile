import type { BloomLevel, Difficulty, QuizQuestion } from "@/features/instructor/types/instructor";
import { newId } from "./format";

export type GenerateParams = { topic: string; count: number; difficulty: Difficulty };

const BLOOM_LEVELS: BloomLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

/**
 * MOCK generator so the flow works end to end. Multiple Choice only, each item tagged with a
 * Bloom level and difficulty (docs/UI-BRIEF Bloom's Taxonomy Quiz Synthesizer).
 * TODO: replace the body with a call to your PHP backend (e.g. POST /instructor/ai-quiz),
 * which calls the AI provider server-side. Never ship an API key inside the app.
 * Keep the signature: the screens don't need to change.
 */
export async function generateQuiz({ topic, count, difficulty }: GenerateParams): Promise<QuizQuestion[]> {
  await new Promise((r) => setTimeout(r, 900));
  return Array.from({ length: count }, (_, i) => ({
    id: newId("q"),
    type: "multiple_choice" as const,
    text: `Question ${i + 1}: Which statement about ${topic} is correct?`,
    options: [
      `Sample answer A about ${topic}`,
      `Sample answer B about ${topic}`,
      `Sample answer C about ${topic}`,
      `Sample answer D about ${topic}`,
    ],
    correctIndex: i % 4,
    correctAnswer: null,
    bloom: BLOOM_LEVELS[i % BLOOM_LEVELS.length]!,
    difficulty,
    points: 1,
  }));
}
