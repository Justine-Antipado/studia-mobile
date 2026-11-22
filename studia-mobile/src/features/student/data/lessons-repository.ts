// lessons-repository.ts — student view over the shared mock DB materials: lesson list, transcript
// and the AI summary. Videos are LINKS (YouTube thumbnail + "Watch on YouTube"); the summary is
// produced from the transcript on the server and cached, and Regenerate is rate-limited.
import { isRemote } from "@/core/config/data-source";
import { RemoteLessonRepository } from "@/features/student/data/lessons-remote";
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { ME, type DbMaterial } from "@/core/data/mock/mock-db";
import { mockCall } from "@/core/data/mock/mock-latency";
import { MAX_SUMMARY_REGENS, materialsOf, regenerateSummary, visibleMaterial } from "@/core/data/mock/mock-materials";
import type { Lesson } from "@/features/student/types/student";

export interface LessonRepository {
  listByClass(classId: string): Promise<Result<Lesson[]>>;
  get(classId: string, id: string): Promise<Result<Lesson | null>>;
  /** Re-runs the AI summary. Capped per lesson; 409 once the cap is reached. */
  regenerateSummary(classId: string, id: string): Promise<Result<Lesson>>;
}

const toLesson = (m: DbMaterial): Lesson => ({
  id: m.id,
  classId: m.classId,
  title: m.title,
  kind: m.kind,
  link: m.link,
  durationLabel: m.durationLabel,
  attachment: m.attachment,
  processing: m.processing,
  transcript: m.transcript,
  aiSummary: m.aiSummary,
  regensLeft: Math.max(0, MAX_SUMMARY_REGENS - m.summaryRegens),
  postedAt: m.postedAt,
});

class MockLessonRepository implements LessonRepository {
  listByClass(classId: string): Promise<Result<Lesson[]>> {
    return mockCall(() => materialsOf(classId, ME.student).map(toLesson));
  }

  get(classId: string, id: string): Promise<Result<Lesson | null>> {
    return mockCall(() => {
      const m = visibleMaterial(classId, id, ME.student);
      return m ? toLesson(m) : null;
    });
  }

  async regenerateSummary(classId: string, id: string): Promise<Result<Lesson>> {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const m = visibleMaterial(classId, id, ME.student);
    if (!m) return fail(appError("not_found", "This lesson no longer exists."));
    const r = regenerateSummary(m);
    if (!r.ok) {
      return fail(
        r.reason === "limit"
          ? appError("conflict", `You can regenerate this summary ${MAX_SUMMARY_REGENS} times. The limit was reached.`, false)
          : appError("conflict", "There is no transcript to summarise yet.", false),
      );
    }
    return ok(toLesson(r.material));
  }
}

export const lessonRepository: LessonRepository = isRemote ? new RemoteLessonRepository() : new MockLessonRepository();
