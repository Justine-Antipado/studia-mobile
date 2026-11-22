// quizzes-remote.ts: instructor quizzes in Supabase. A quiz is saved with ONE call (save_quiz) so the
// answer-key checks see the whole question; after any student has taken it the questions are locked
// by database triggers (this file only gives the friendlier message first).
import { appError, fail, ok, type Result } from "@/core/data/errors/app-error";
import { db, guard, must } from "@/core/data/supabase/remote";
import type { QuizRepository } from "@/features/instructor/data/quizzes-repository";
import { defaultSchedule, validateSchedule } from "@/features/instructor/logic/quiz-schedule";
import { validateQuizDraft } from "@/features/instructor/logic/quiz-validation";
import type { Quiz, QuizDraft, QuizQuestion } from "@/features/instructor/types/instructor";

type Key = { correct_index: number | null; correct_answer: string | null; rationale: string | null };
type QRow = {
  id: string;
  position: number;
  type: QuizQuestion["type"];
  prompt: string;
  bloom: QuizQuestion["bloom"];
  difficulty: QuizQuestion["difficulty"];
  points: number;
  options: { position: number; body: string }[];
  key: Key | Key[] | null;
};
type Row = {
  id: string;
  class_id: string;
  title: string;
  status: Quiz["status"];
  source: Quiz["source"];
  time_limit_min: number | null;
  due_at: string | null;
  allow_late: boolean;
  closes_at: string | null;
  created_at: string;
  class: { subject_code: string } | null;
  questions: QRow[];
  attempts: { count: number }[];
};

const SELECT =
  "id, class_id, title, status, source, time_limit_min, due_at, allow_late, closes_at, created_at, class:classes(subject_code), attempts:quiz_attempts(count), questions:quiz_questions(id, position, type, prompt, bloom, difficulty, points, options:quiz_options(position, body), key:quiz_question_keys(correct_index, correct_answer, rationale))";

const keyOf = (k: QRow["key"]): Key | null => (Array.isArray(k) ? (k[0] ?? null) : k);

function toQuiz(r: Row): Quiz {
  return {
    id: r.id,
    title: r.title,
    classId: r.class_id,
    classCode: r.class?.subject_code ?? "",
    status: r.status,
    source: r.source,
    createdAt: r.created_at,
    dueAt: r.due_at,
    allowLate: r.allow_late,
    closesAt: r.closes_at,
    timeLimitMin: r.time_limit_min,
    attemptCount: r.attempts?.[0]?.count ?? 0,
    questions: [...r.questions]
      .sort((a, b) => a.position - b.position)
      .map<QuizQuestion>((q) => {
        const k = keyOf(q.key);
        return {
          id: q.id,
          type: q.type,
          text: q.prompt,
          options: q.type === "multiple_choice" ? [...q.options].sort((a, b) => a.position - b.position).map((o) => o.body) : null,
          correctIndex: k?.correct_index ?? null,
          correctAnswer: k?.correct_answer ?? null,
          bloom: q.bloom,
          difficulty: q.difficulty,
          points: q.points,
        };
      }),
  };
}

const questionPayload = (draft: QuizDraft) =>
  draft.questions.map((q) => ({
    type: q.type,
    prompt: q.text.trim(),
    options: q.options ? q.options.map((o) => o.trim()) : null,
    correct_index: q.correctIndex,
    correct_answer: q.correctAnswer,
    bloom: q.bloom,
    difficulty: q.difficulty,
    points: q.points,
  }));

/** Comparable form of a stored quiz's questions, to tell whether an edit changed them. */
const signature = (qs: QuizQuestion[]) =>
  JSON.stringify(qs.map((q) => [q.type, q.text.trim(), q.options?.map((o) => o.trim()) ?? null, q.correctIndex, q.correctAnswer, q.bloom, q.difficulty, q.points]));

async function fetchAll(classId: string | null): Promise<Quiz[]> {
  let q = db().from("quizzes").select(SELECT).is("deleted_at", null).order("created_at", { ascending: false });
  if (classId) q = q.eq("class_id", classId);
  return (must(await q) as Row[]).map(toQuiz);
}

async function fetchOne(id: string): Promise<Quiz | null> {
  const row = must(await db().from("quizzes").select(SELECT).eq("id", id).is("deleted_at", null).maybeSingle()) as Row | null;
  return row ? toQuiz(row) : null;
}

export class RemoteInstructorQuizRepository implements QuizRepository {
  list(): Promise<Result<Quiz[]>> {
    return guard(() => fetchAll(null));
  }

  listByClass(classId: string): Promise<Result<Quiz[]>> {
    return guard(() => fetchAll(classId));
  }

  get(id: string): Promise<Result<Quiz | null>> {
    return guard(() => fetchOne(id));
  }

  async create(draft: QuizDraft, publish: boolean): Promise<Result<Quiz>> {
    const error = validateQuizDraft(draft, publish);
    if (error) return fail(appError("validation", error, false));
    if (!draft.classId) return fail(appError("validation", "Choose a class for this quiz.", false));
    const schedule = draft.schedule ?? defaultSchedule();
    const scheduleError = publish ? validateSchedule(schedule, "create") : null;
    if (scheduleError) return fail(appError("validation", scheduleError, false));
    return guard(async () => {
      const id = must(
        await db().rpc("save_quiz", {
          p_quiz: {
            class_id: draft.classId,
            title: draft.title.trim(),
            status: publish ? "published" : "draft",
            source: draft.source,
            time_limit_min: schedule.timeLimitMin,
            due_at: schedule.dueAt,
            allow_late: schedule.allowLate,
            closes_at: schedule.allowLate ? schedule.closesAt : null,
            questions: questionPayload(draft),
          },
          p_replace_questions: true,
        }),
      ) as string;
      const made = await fetchOne(id);
      if (!made) throw appError("not_found", "This quiz no longer exists.");
      return made;
    }, "This class no longer exists.");
  }

  async update(id: string, draft: QuizDraft, publish: boolean): Promise<Result<Quiz>> {
    const current = await this.get(id);
    if (!current.ok) return current;
    if (!current.value) return fail(appError("not_found", "This quiz no longer exists."));
    const error = validateQuizDraft(draft, publish);
    if (error) return fail(appError("validation", error, false));
    const schedule = draft.schedule ?? defaultSchedule();
    const scheduleError = publish ? validateSchedule(schedule, "edit") : null;
    if (scheduleError) return fail(appError("validation", scheduleError, false));

    const attempts = current.value.attemptCount;
    const changed = signature(draft.questions) !== signature(current.value.questions);
    if (attempts > 0 && changed) {
      return fail(
        appError("conflict", `${attempts} student${attempts === 1 ? " has" : "s have"} already taken this quiz, so its questions can't be changed. You can still edit the title and schedule.`, false),
      );
    }
    if (attempts > 0 && !publish) {
      return fail(appError("conflict", "A quiz that students already took can't go back to a draft.", false));
    }
    return guard(async () => {
      must(
        await db().rpc("save_quiz", {
          p_quiz: {
            id,
            class_id: current.value!.classId,
            title: draft.title.trim(),
            status: publish ? "published" : "draft",
            source: current.value!.source,
            time_limit_min: schedule.timeLimitMin,
            due_at: schedule.dueAt,
            allow_late: schedule.allowLate,
            closes_at: schedule.allowLate ? schedule.closesAt : null,
            questions: questionPayload(draft),
          },
          p_replace_questions: changed,
        }),
      );
      const next = await fetchOne(id);
      if (!next) throw appError("not_found", "This quiz no longer exists.");
      return next;
    }, "This quiz no longer exists.");
  }

  async remove(id: string): Promise<Result<void>> {
    const res = await guard(async () => {
      const rows = must(await db().from("quizzes").delete().eq("id", id).select("id")) as unknown[];
      if (rows.length === 0) throw appError("not_found", "This quiz no longer exists.");
    });
    return res.ok ? ok(undefined) : res;
  }
}
