// gradebook-remote.ts: one row per (student, assignment-or-quiz) for the classes this instructor owns,
// built from the same tables the grading screens use (RLS limits every query to the owner's classes).
import type { Result } from "@/core/data/errors/app-error";
import { db, guard, must } from "@/core/data/supabase/remote";
import type { GradebookRepository, GradeEntry, GradeStatus } from "@/features/instructor/data/gradebook-repository";

type Cls = { id: string; subject_code: string };
type Enr = { class_id: string; student: { id: string; full_name: string } | null };
type Asg = { id: string; class_id: string; title: string; points: number };
type Sub = { assignment_id: string; student_id: string; status: string; score: number | null; graded_at: string | null };
type Qz = { id: string; class_id: string; title: string };
type Att = { id: string; quiz_id: string; student_id: string; score: number | null; max_score: number; graded_at: string | null };

async function build(classId: string | null): Promise<GradeEntry[]> {
  const cq = db().from("classes").select("id, subject_code").is("deleted_at", null);
  const classes = must(await (classId ? cq.eq("id", classId) : cq)) as Cls[];
  if (classes.length === 0) return [];
  const ids = classes.map((c) => c.id);

  const [enr, asg, qz] = await Promise.all([
    db().from("class_enrollments").select("class_id, student:users!class_enrollments_student_id_fkey(id, full_name)").in("class_id", ids).is("left_at", null),
    db().from("assignments").select("id, class_id, title, points").in("class_id", ids).is("deleted_at", null),
    db().from("quizzes").select("id, class_id, title").in("class_id", ids).eq("status", "published").is("deleted_at", null),
  ]);
  const enrollments = must(enr) as Enr[];
  const assignments = must(asg) as Asg[];
  const quizzes = must(qz) as Qz[];

  const [subsRes, attsRes] = await Promise.all([
    assignments.length
      ? db().from("assignment_submissions").select("assignment_id, student_id, status, score, graded_at").in("assignment_id", assignments.map((a) => a.id))
      : Promise.resolve({ data: [], error: null }),
    quizzes.length
      ? db().from("quiz_attempts").select("id, quiz_id, student_id, score, max_score, graded_at").in("quiz_id", quizzes.map((q) => q.id)).not("submitted_at", "is", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const maxByQuiz = new Map<string, number>();
  if (quizzes.length) {
    const qs = must(await db().from("quiz_questions").select("quiz_id, points").in("quiz_id", quizzes.map((q) => q.id))) as { quiz_id: string; points: number }[];
    qs.forEach((x) => maxByQuiz.set(x.quiz_id, (maxByQuiz.get(x.quiz_id) ?? 0) + x.points));
  }
  const subs = new Map((must(subsRes) as Sub[]).map((s) => [`${s.assignment_id}|${s.student_id}`, s]));
  const atts = new Map((must(attsRes) as Att[]).map((a) => [`${a.quiz_id}|${a.student_id}`, a]));

  const out: GradeEntry[] = [];
  for (const cls of classes) {
    const students = enrollments.filter((e) => e.class_id === cls.id).flatMap((e) => (e.student ? [e.student] : []));
    for (const a of assignments.filter((x) => x.class_id === cls.id)) {
      for (const u of students) {
        const s = subs.get(`${a.id}|${u.id}`);
        const status: GradeStatus = s?.status === "graded" ? "graded" : s && s.status !== "draft" ? "pending" : "missing";
        out.push({
          id: `as_${a.id}_${u.id}`,
          classId: cls.id,
          classCode: cls.subject_code,
          kind: "assignment",
          refId: a.id,
          title: a.title,
          studentId: u.id,
          studentName: u.full_name,
          score: status === "graded" ? (s?.score ?? null) : null,
          max: a.points,
          status,
          gradedAt: s?.graded_at ?? null,
          attemptId: null,
        });
      }
    }
    for (const q of quizzes.filter((x) => x.class_id === cls.id)) {
      for (const u of students) {
        const att = atts.get(`${q.id}|${u.id}`);
        const status: GradeStatus = !att ? "missing" : att.graded_at ? "graded" : "pending";
        out.push({
          id: `qz_${q.id}_${u.id}`,
          classId: cls.id,
          classCode: cls.subject_code,
          kind: "quiz",
          refId: q.id,
          title: q.title,
          studentId: u.id,
          studentName: u.full_name,
          score: att && status === "graded" ? att.score : null,
          max: maxByQuiz.get(q.id) ?? 0,
          status,
          gradedAt: att?.graded_at ?? null,
          attemptId: att?.id ?? null,
        });
      }
    }
  }
  return out;
}

export class RemoteGradebookRepository implements GradebookRepository {
  list(classId: string | null): Promise<Result<GradeEntry[]>> {
    return guard(() => build(classId));
  }
}
