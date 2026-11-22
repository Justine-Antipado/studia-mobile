// lessons-repository.ts — student view of class materials: lesson list, transcript and the AI
// summary. Videos are LINKS (YouTube thumbnail + "Watch on YouTube"); the summary is produced from
// the transcript on the server and cached, and Regenerate is rate-limited.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteLessonRepository } from "@/features/student/data/lessons-remote";
import type { Lesson } from "@/features/student/types/student";

export interface LessonRepository {
  listByClass(classId: string): Promise<Result<Lesson[]>>;
  get(classId: string, id: string): Promise<Result<Lesson | null>>;
  /** Re-runs the AI summary. Capped per lesson; 409 once the cap is reached. */
  regenerateSummary(classId: string, id: string): Promise<Result<Lesson>>;
}

export const lessonRepository: LessonRepository = new RemoteLessonRepository();
