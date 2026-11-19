// quizzes-repository.ts — manual + AI-synthesized quizzes (Multiple Choice from the AI
// synthesizer; manual quizzes also support Identification and Essay elsewhere in the editor).
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import { CLASS_DIRECTORY } from "@/features/instructor/data/class-directory";
import { newId } from "@/features/instructor/logic/format";
import { validateQuizDraft } from "@/features/instructor/logic/quiz-validation";
import type { Quiz, QuizDraft } from "@/features/instructor/types/instructor";

export interface QuizRepository {
  list(): Promise<Result<Quiz[]>>;
  listByClass(classId: string): Promise<Result<Quiz[]>>;
  get(id: string): Promise<Result<Quiz | null>>;
  create(draft: QuizDraft, publish: boolean): Promise<Result<Quiz>>;
  remove(id: string): Promise<Result<void>>;
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const classIdOf = (code: string) => CLASS_DIRECTORY.find((c) => c.code === code)?.id ?? "";

let QUIZZES: Quiz[] = [
  { id: "quiz_it321_1", title: "Quiz 1: CIA Triad", classId: classIdOf("IT 321"), classCode: "IT 321", questions: [], status: "published", source: "manual", createdAt: ago(60 * 24 * 14) },
  { id: "quiz_it321_2", title: "Quiz 2: Network Security", classId: classIdOf("IT 321"), classCode: "IT 321", questions: [], status: "published", source: "manual", createdAt: ago(60 * 24 * 3) },
  { id: "quiz_it314_1", title: "Quiz 1: REST APIs", classId: classIdOf("IT 314"), classCode: "IT 314", questions: [], status: "published", source: "manual", createdAt: ago(60 * 24 * 10) },
  { id: "quiz_it314_2", title: "Quiz 3: REST APIs", classId: classIdOf("IT 314"), classCode: "IT 314", questions: [], status: "draft", source: "manual", createdAt: ago(60 * 2) },
];

class MockQuizRepository implements QuizRepository {
  list(): Promise<Result<Quiz[]>> {
    return mockCall(() => [...QUIZZES].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  listByClass(classId: string): Promise<Result<Quiz[]>> {
    return mockCall(() =>
      QUIZZES.filter((q) => q.classId === classId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  get(id: string): Promise<Result<Quiz | null>> {
    return mockCall(() => QUIZZES.find((q) => q.id === id) ?? null);
  }

  async create(draft: QuizDraft, publish: boolean): Promise<Result<Quiz>> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const error = validateQuizDraft(draft, publish);
    if (error) return fail(appError("validation", error, false));
    const cls = CLASS_DIRECTORY.find((c) => c.id === draft.classId);
    if (!cls) return fail(appError("validation", "Choose a class for this quiz.", false));

    const quiz: Quiz = {
      id: newId("quiz"),
      title: draft.title.trim(),
      classId: cls.id,
      classCode: cls.code,
      questions: draft.questions.map((q) => ({
        ...q,
        text: q.text.trim(),
        options: q.options ? q.options.map((o) => o.trim()) : null,
      })),
      status: publish ? "published" : "draft",
      source: draft.source,
      createdAt: new Date().toISOString(),
    };
    QUIZZES = [quiz, ...QUIZZES];
    return ok(quiz);
  }

  async remove(id: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!QUIZZES.some((q) => q.id === id)) return fail(appError("not_found", "This quiz no longer exists."));
    QUIZZES = QUIZZES.filter((q) => q.id !== id);
    return ok(undefined);
  }
}

export const quizRepository: QuizRepository = new MockQuizRepository();
