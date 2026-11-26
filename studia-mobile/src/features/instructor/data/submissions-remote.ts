// submissions-remote.ts: quiz attempts as the instructor sees them. Multiple choice is scored by
// submit_quiz and never needs review; an attempt with an essay or identification question has
// graded_at = null until the instructor sets points for each of those questions (grade_quiz_question)
// and turns the grade in (release_quiz_grade RPC, migration 042) -- which is what "needs grading" means.
import { appError, fail, type Result } from "@/core/data/errors/app-error";
import { db, guard, must } from "@/core/data/supabase/remote";
import type { SubmissionRepository } from "@/features/instructor/data/submissions-repository";
import { parseScore } from "@/features/instructor/logic/quiz-validation";
import type { Submission, SubmissionAnswer } from "@/features/instructor/types/instructor";

type Attempt = {
  id: string;
  quiz_id: string;
  submitted_at: string;
  score: number | null;
  max_score: number;
  graded_at: string | null;
  feedback: string;
  late: boolean;
  over_time: boolean;
  student: { full_name: string } | null;
  quiz: { title: string; class: { subject_code: string } | null } | null;
  answers: { question_id: string; response_text: string | null; awarded_points: number | null }[];
};
type Key = { correct_answer: string | null };
type Question = {
  id: string;
  quiz_id: string;
  position: number;
  type: string;
  prompt: string;
  points: number;
  key: Key | Key[] | null;
};

const SELECT =
  "id, quiz_id, submitted_at, score, max_score, graded_at, feedback, late, over_time, student:users!quiz_attempts_student_id_fkey(full_name), quiz:quizzes(title, class:classes(subject_code)), answers:quiz_answers(question_id, response_text, awarded_points)";

const keyOf = (k: Question["key"]): Key | null => (Array.isArray(k) ? (k[0] ?? null) : k);

async function load(filter: { quizId?: string; id?: string }): Promise<Submission[]> {
  let q = db().from("quiz_attempts").select(SELECT).not("submitted_at", "is", null).order("submitted_at", { ascending: false });
  if (filter.quizId) q = q.eq("quiz_id", filter.quizId);
  if (filter.id) q = q.eq("id", filter.id);
  const attempts = must(await q) as Attempt[];
  if (attempts.length === 0) return [];
  const quizIds = [...new Set(attempts.map((a) => a.quiz_id))];
  const questions = must(
    await db()
      .from("quiz_questions")
      .select("id, quiz_id, position, type, prompt, points, key:quiz_question_keys(correct_answer)")
      .in("quiz_id", quizIds),
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
      overTime: a.over_time ?? false,
      answers: qs
        .filter((x) => x.type === "essay" || x.type === "identification")
        .map<SubmissionAnswer>((x) => {
          const r = answered.get(x.id);
          const text = r?.response_text?.trim();
          return {
            questionId: x.id,
            type: x.type as "essay" | "identification",
            prompt: x.prompt,
            response: text ? text : "(no answer)",
            maxPoints: x.points,
            awardedPoints: r?.awarded_points ?? null,
            correctAnswer: x.type === "identification" ? (keyOf(x.key)?.correct_answer ?? null) : null,
          };
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

  async gradeQuestion(attemptId: string, questionId: string, pointsInput: string): Promise<Result<Submission>> {
    const current = await this.get(attemptId);
    if (!current.ok) return current;
    if (!current.value) return fail(appError("not_found", "This submission no longer exists."));
    const question = current.value.answers.find((x) => x.questionId === questionId);
    if (!question) return fail(appError("not_found", "This question no longer exists."));
    const parsed = parseScore(pointsInput, question.maxPoints);
    if (!parsed.ok) return fail(appError("validation", parsed.error, false));
    return guard(async () => {
      must(await db().rpc("grade_quiz_question", { p_attempt_id: attemptId, p_question_id: questionId, p_points: parsed.value }));
      const next = (await load({ id: attemptId }))[0];
      if (!next) throw appError("not_found", "This submission no longer exists.");
      return next;
    }, "This submission no longer exists.");
  }

  async release(attemptId: string, feedback: string): Promise<Result<Submission>> {
    const current = await this.get(attemptId);
    if (!current.ok) return current;
    if (!current.value) return fail(appError("not_found", "This submission no longer exists."));
    if (current.value.answers.some((x) => x.awardedPoints === null)) {
      return fail(appError("validation", "Every question needs points before you can release this grade.", false));
    }
    return guard(async () => {
      must(await db().rpc("release_quiz_grade", { p_attempt_id: attemptId, p_feedback: feedback.trim() }));
      const next = (await load({ id: attemptId }))[0];
      if (!next) throw appError("not_found", "This submission no longer exists.");
      return next;
    }, "This submission no longer exists.");
  }
}
