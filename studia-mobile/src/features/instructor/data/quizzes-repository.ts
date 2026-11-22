// quizzes-repository.ts — manual + AI-synthesized quizzes, as a view over the shared mock DB.
// A published quiz appears in the students' course Tasks; drafts never do. Schedule rules
// (due / late window / time limit) are validated here as the server must: closes-at after due,
// and once any student has submitted the questions are locked (editing correct answers or points
// would silently invalidate scores that were already given).
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { ME, dbId, mockDb, type DbQuestion, type DbQuiz } from "@/core/data/mock/mock-db";
import { classCodeOf, notify, studentIdsOf } from "@/core/data/mock/mock-notifications";
import { mockCall } from "@/core/data/mock/mock-latency";
import { ownedQuizzes } from "@/core/data/mock/mock-quizzes";
import { defaultSchedule, validateSchedule } from "@/features/instructor/logic/quiz-schedule";
import { validateQuizDraft } from "@/features/instructor/logic/quiz-validation";
import type { Quiz, QuizDraft, QuizQuestion } from "@/features/instructor/types/instructor";
import { mockNowIso } from "@/core/data/mock/mock-clock";

export interface QuizRepository {
  list(): Promise<Result<Quiz[]>>;
  listByClass(classId: string): Promise<Result<Quiz[]>>;
  get(id: string): Promise<Result<Quiz | null>>;
  create(draft: QuizDraft, publish: boolean): Promise<Result<Quiz>>;
  update(id: string, draft: QuizDraft, publish: boolean): Promise<Result<Quiz>>;
  remove(id: string): Promise<Result<void>>;
}

function toQuiz(q: DbQuiz): Quiz {
  return {
    id: q.id,
    title: q.title,
    classId: q.classId,
    classCode: mockDb.cls(q.classId)?.code ?? "",
    questions: q.questions.map<QuizQuestion>((x) => ({
      id: x.id,
      type: x.type,
      text: x.prompt,
      options: x.options,
      correctIndex: x.correctIndex,
      correctAnswer: x.correctAnswer,
      bloom: x.bloom,
      difficulty: x.difficulty,
      points: x.points,
    })),
    status: q.status,
    source: q.source,
    createdAt: q.createdAt,
    dueAt: q.dueAt,
    allowLate: q.allowLate,
    closesAt: q.closesAt,
    timeLimitMin: q.timeLimitMin,
    attemptCount: mockDb.attempts.filter((a) => a.quizId === q.id).length,
  };
}

const toDbQuestions = (draft: QuizDraft): DbQuestion[] =>
  draft.questions.map<DbQuestion>((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.text.trim(),
    options: q.options ? q.options.map((o) => o.trim()) : null,
    correctIndex: q.correctIndex,
    correctAnswer: q.correctAnswer,
    bloom: q.bloom,
    difficulty: q.difficulty,
    points: q.points,
    rationale: null,
  }));

const sameQuestions = (a: DbQuestion[], b: DbQuestion[]) => JSON.stringify(a) === JSON.stringify(b);

function announceQuiz(q: DbQuiz) {
  notify(studentIdsOf(q.classId), {
    tag: "Quiz",
    title: `New quiz: ${q.title}`,
    meta: classCodeOf(q.classId),
    body: q.dueAt ? `Due ${new Date(q.dueAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })}.` : undefined,
  });
}

class MockQuizRepository implements QuizRepository {
  list(): Promise<Result<Quiz[]>> {
    return mockCall(() => ownedQuizzes(ME.instructor).map(toQuiz).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  listByClass(classId: string): Promise<Result<Quiz[]>> {
    return mockCall(() =>
      ownedQuizzes(ME.instructor)
        .filter((q) => q.classId === classId)
        .map(toQuiz)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  get(id: string): Promise<Result<Quiz | null>> {
    return mockCall(() => {
      const q = ownedQuizzes(ME.instructor).find((x) => x.id === id);
      return q ? toQuiz(q) : null;
    });
  }

  async create(draft: QuizDraft, publish: boolean): Promise<Result<Quiz>> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const error = validateQuizDraft(draft, publish);
    if (error) return fail(appError("validation", error, false));
    const cls = draft.classId ? mockDb.cls(draft.classId) : undefined;
    if (!cls || cls.ownerId !== ME.instructor) return fail(appError("validation", "Choose a class for this quiz.", false));

    const schedule = draft.schedule ?? defaultSchedule();
    const scheduleError = publish ? validateSchedule(schedule, "create") : null;
    if (scheduleError) return fail(appError("validation", scheduleError, false));

    const quiz: DbQuiz = {
      id: dbId("quiz"),
      classId: cls.id,
      title: draft.title.trim(),
      status: publish ? "published" : "draft",
      source: draft.source,
      timeLimitMin: schedule.timeLimitMin,
      dueAt: schedule.dueAt,
      allowLate: schedule.allowLate,
      closesAt: schedule.allowLate ? schedule.closesAt : null,
      createdAt: mockNowIso(),
      questions: toDbQuestions(draft),
    };
    mockDb.quizzes = [quiz, ...mockDb.quizzes];
    mockDb.emit();
    if (publish) announceQuiz(quiz);
    return ok(toQuiz(quiz));
  }

  async update(id: string, draft: QuizDraft, publish: boolean): Promise<Result<Quiz>> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const current = ownedQuizzes(ME.instructor).find((q) => q.id === id);
    if (!current) return fail(appError("not_found", "This quiz no longer exists."));
    const error = validateQuizDraft(draft, publish);
    if (error) return fail(appError("validation", error, false));
    const schedule = draft.schedule ?? defaultSchedule();
    // Editing an already-published quiz may keep a passed due date (e.g. to extend it later).
    const scheduleError = publish ? validateSchedule(schedule, "edit") : null;
    if (scheduleError) return fail(appError("validation", scheduleError, false));

    const attempts = mockDb.attempts.filter((a) => a.quizId === id).length;
    const questions = toDbQuestions(draft);
    if (attempts > 0 && !sameQuestions(questions, current.questions)) {
      return fail(
        appError("conflict", `${attempts} student${attempts === 1 ? " has" : "s have"} already taken this quiz, so its questions can't be changed. You can still edit the title and schedule.`, false),
      );
    }
    if (attempts > 0 && !publish) {
      return fail(appError("conflict", "A quiz that students already took can't go back to a draft.", false));
    }

    const next: DbQuiz = {
      ...current,
      title: draft.title.trim(),
      status: publish ? "published" : "draft",
      timeLimitMin: schedule.timeLimitMin,
      dueAt: schedule.dueAt,
      allowLate: schedule.allowLate,
      closesAt: schedule.allowLate ? schedule.closesAt : null,
      questions: attempts > 0 ? current.questions : questions,
    };
    mockDb.quizzes = mockDb.quizzes.map((q) => (q.id === id ? next : q));
    mockDb.emit();
    if (current.status === "draft" && publish) announceQuiz(next);
    return ok(toQuiz(next));
  }

  async remove(id: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!ownedQuizzes(ME.instructor).some((q) => q.id === id)) {
      return fail(appError("not_found", "This quiz no longer exists."));
    }
    mockDb.quizzes = mockDb.quizzes.filter((q) => q.id !== id);
    mockDb.attempts = mockDb.attempts.filter((a) => a.quizId !== id);
    mockDb.emit();
    return ok(undefined);
  }
}

export const quizRepository: QuizRepository = new MockQuizRepository();
