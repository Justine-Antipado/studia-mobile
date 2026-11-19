import type { QuizQuestion } from "@/features/instructor/types/instructor";
import { newId } from "./format";

export type Difficulty = "Easy" | "Medium" | "Hard";
export type GenerateParams = { topic: string; count: number; difficulty: Difficulty };

/**
 * MOCK generator so the flow works end to end.
 * TODO: replace the body with a call to your PHP backend (e.g. POST /instructor/ai-quiz),
 * which calls the AI provider server-side. Never ship an API key inside the app.
 * Keep the signature: the screens don't need to change.
 */
export async function generateQuiz({ topic, count, difficulty }: GenerateParams): Promise<QuizQuestion[]> {
  await new Promise((r) => setTimeout(r, 900));
  return Array.from({ length: count }, (_, i) => ({
    id: newId("q"),
    text: `[${difficulty}] Question ${i + 1}: Which statement about ${topic} is correct?`,
    options: [
      `Sample answer A about ${topic}`,
      `Sample answer B about ${topic}`,
      `Sample answer C about ${topic}`,
      `Sample answer D about ${topic}`,
    ],
    correctIndex: i % 4,
  }));
}
