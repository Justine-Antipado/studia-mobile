// submissions-remote.ts: quiz attempts as the instructor sees them. Multiple choice and
// identification were scored by submit_quiz; an attempt with an essay has graded_at = null until the
// instructor grades it here (grade_quiz_attempt RPC), which is what "needs grading" means.
import { appError, fail, type Result } from "@/core/data/errors/app-error";
import { db, guard, must } from "@/core/data/supabase/remote";
import type { SubmissionRepository } from "@/features/instructor/data/submissions-repository";
import { parseScore } from "@/features/instructor/logic/quiz-validation";
import type { Submission } from "@/features/instructor/types/instructor";

type Attempt = {
  id: string;
  quiz_id: string;
  submitted_at: string;
  score: number | null;
  max_score: number;
  graded_at: string | null;
  feedback: string;
  late: boolean;
  student: { full_name: string } | null;
  quiz: { title: string; class: { subject_code: string } | null } | null;
  answers: { question_id: string; response_index: number | null; response_text: string | null }[];
};
type Question = { id: string; quiz_id: string; position: number; type: string; prompt: string; options: { position: number; body: string }[] };

const SELECT =
  "id, quiz_id, submitted_at, score, max_score, graded_at, feedback, late, student:users!quiz_attempts_student_id_fkey(full_name), quiz:quizzes(title, class:classes(subject_code)), answers:quiz_answers(question_id, response_index, response_text)";

async function load(filter: { quizId?: string; id?: string }): Promise<Submission[]> {
  let q = db().from("quiz_attempts").select(SELECT).not("submitted_at", "is", null).order("submitted_at", { ascending: false });
  if (filter.quizId) q = q.eq("quiz_id", filter.quizId);
  if (filter.id) q = q.eq("id", filter.id);
  const attempts = must(await q) as Attempt[];
  if (attempts.length === 0) return [];
  const quizIds = [...new Set(attempts.map((a) => a.quiz_id))];
  const questions = must(
    await db().from("quiz_questions").select("id, quiz_id, position, type, prompt, options:quiz_options(position, body)").in("quiz_id", quizIds),
  ) as Question[];
  const byQuiz = new Map<string, Question[]>();
  questions.forEach((x) => byQuiz.set(x.quiz_id, [...(byQuiz.get(x.quiz_id) ?? []), x]));

  return attempts.map<Submission>((a) => {
    const qs = (byQuiz.get(a.quiz_id) ?? []).sort((x, y) => x.position - y.position);
    const answered = new Map(a.answers.map((x) => [x.question_id, x]));
    const pending = a.graded_at === null;
    return {
      id: a.id,
      studentName: a.student?.full_name ?? "Former student",
      classCode: a.quiz?.class?.subject_code ?? "",
      quizId: a.quiz_id,
      quizTitle: a.quiz?.title ?? "",
      submittedAt: a.submitted_at,
      maxScore: a.max_score,
      score: pending ? null : a.score,
      gradedAt: a.graded_at,
      feedback: a.feedback ?? "",
      late: a.late,
      answers: qs
        .filter((x) => x.type === "essay" || x.type === "identification")
        .map((x) => {
          const r = answered.get(x.id);
          const text = r?.response_text?.trim();
          return { prompt: x.prompt, response: text ? text : "(no answer)" };
        }),
    };
  });
}

export class RemoteSubmissionRepository implements SubmissionRepository {
  list(): Promise<Result<Submission[]>> {
    return guard(() => load({}));
  }

  listByQuiz(quizId: string): Promise<Result<Submission[]>> {
    return guard(() => load({ quizId }));
  }

  get(id: string): Promise<Result<Submission | null>> {
    return guard(async () => (await load({ id }))[0] ?? null);
  }

  async grade(id: string, scoreInput: string, feedback: string): Promise<Result<Submission>> {
    const current = await this.get(id);
    if (!current.ok) return current;
    if (!current.value) return fail(appError("not_found", "This submission no longer exists."));
    const parsed = parseScore(scoreInput, current.value.maxScore);
    if (!parsed.ok) return fail(appError("validation", parsed.error, false));
    return guard(async () => {
      must(await db().rpc("grade_quiz_attempt", { p_attempt_id: id, p_score: parsed.value, p_feedback: feedback.trim() }));
      const next = (await load({ id }))[0];
      if (!next) throw appError("not_found", "This submission no longer exists.");
      return next;
    }, "This submission no longer exists.");
  }
}
