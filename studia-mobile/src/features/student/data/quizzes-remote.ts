// quizzes-remote.ts: student quizzes from Supabase. Answer keys come back only once RLS allows it
// (after the student is finished with the quiz). Submitting is the submit_quiz RPC, which scores
// multiple choice / identification on the server and leaves essays for the instructor.
import { appError, type Result } from "@/core/data/errors/app-error";
import { db, guard, must, myId } from "@/core/data/supabase/remote";
import type { QuizRepository } from "@/features/student/data/quizzes-repository";
import type { BloomLevel, Difficulty, Quiz, QuizAnswer, QuizAttempt, QuizQuestion, QuizQuestionType } from "@/features/student/types/student";

type Key = { correct_index: number | null; correct_answer: string | null; rationale: string | null };
type QRow = {
  id: string;
  position: number;
  type: QuizQuestionType;
  prompt: string;
  bloom: BloomLevel | null;
  difficulty: Difficulty | null;
  points: number;
  options: { position: number; body: string }[];
  key: Key | Key[] | null;
};
type Row = {
  id: string;
  class_id: string;
  title: string;
  time_limit_min: number | null;
  due_at: string | null;
  allow_late: boolean;
  closes_at: string | null;
  questions: QRow[];
};
type AttemptRow = {
  id: string;
  quiz_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number;
  graded_at: string | null;
  answers: { question_id: string; response_index: number | null; response_text: string | null }[];
};

const SELECT =
  "id, class_id, title, time_limit_min, due_at, allow_late, closes_at, questions:quiz_questions(id, position, type, prompt, bloom, difficulty, points, options:quiz_options(position, body), key:quiz_question_keys(correct_index, correct_answer, rationale))";
const ATTEMPT = "id, quiz_id, started_at, submitted_at, score, max_score, graded_at, answers:quiz_answers(question_id, response_index, response_text)";

const keyOf = (k: QRow["key"]): Key | null => (Array.isArray(k) ? (k[0] ?? null) : k);

function toQuestion(q: QRow): QuizQuestion {
  const k = keyOf(q.key);
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.type === "multiple_choice" ? [...q.options].sort((a, b) => a.position - b.position).map((o) => o.body) : null,
    correctIndex: k?.correct_index ?? null,
    correctAnswer: k?.correct_answer ?? null,
    bloom: q.bloom,
    difficulty: q.difficulty,
    points: q.points,
    rationale: k?.rationale ?? null,
  };
}

function toAttempt(a: AttemptRow | undefined): QuizAttempt | null {
  if (!a) return null;
  return {
    id: a.id,
    quizId: a.quiz_id,
    startedAt: a.started_at,
    submittedAt: a.submitted_at,
    answers: a.answers.map((x) => ({ questionId: x.question_id, response: x.response_index ?? x.response_text ?? null })),
    // Shown only once graded (an ungraded essay keeps the total pending).
    score: a.graded_at ? a.score : null,
    maxScore: a.max_score,
  };
}

function isClosed(q: Row): boolean {
  if (!q.due_at || Date.now() <= new Date(q.due_at).getTime()) return false;
  return !q.allow_late || (q.closes_at !== null && Date.now() > new Date(q.closes_at).getTime());
}

async function load(classId: string, id: string | null): Promise<Quiz[]> {
  const me = await myId();
  let qy = db().from("quizzes").select(SELECT).eq("class_id", classId).eq("status", "published").is("deleted_at", null).order("created_at", { ascending: false });
  if (id) qy = qy.eq("id", id);
  const rows = must(await qy) as Row[];
  if (rows.length === 0) return [];
  const attempts = must(
    await db().from("quiz_attempts").select(ATTEMPT).eq("student_id", me).not("submitted_at", "is", null).in("quiz_id", rows.map((r) => r.id)),
  ) as AttemptRow[];
  const byQuiz = new Map(attempts.map((a) => [a.quiz_id, a]));
  return rows.map((q) => ({
    id: q.id,
    classId: q.class_id,
    title: q.title,
    timeLimitMin: q.time_limit_min,
    dueAt: q.due_at,
    closed: isClosed(q),
    allowLate: q.allow_late,
    attempt: toAttempt(byQuiz.get(q.id)),
    questions: [...q.questions].sort((a, b) => a.position - b.position).map(toQuestion),
  }));
}

export class RemoteQuizRepository implements QuizRepository {
  listByClass(classId: string): Promise<Result<Quiz[]>> {
    return guard(() => load(classId, null));
  }

  get(classId: string, id: string): Promise<Result<Quiz | null>> {
    return guard(async () => (await load(classId, id))[0] ?? null);
  }

  submitAttempt(classId: string, quizId: string, answers: QuizAnswer[]): Promise<Result<QuizAttempt>> {
    return guard(async () => {
      const payload = answers.map((a) =>
        typeof a.response === "number"
          ? { question_id: a.questionId, index: a.response }
          : { question_id: a.questionId, text: a.response ?? "" },
      );
      must(await db().rpc("submit_quiz", { p_quiz_id: quizId, p_answers: payload }));
      const quiz = (await load(classId, quizId))[0];
      if (!quiz?.attempt) throw appError("not_found", "This quiz is no longer available.");
      return quiz.attempt;
    }, "This quiz is no longer available.");
  }
}
