// assignment-submissions-remote.ts: who turned in an assignment, and grading. The list is the class
// roster LEFT-joined with submissions, so students who never started show as "missing". Grading is
// the grade_assignment RPC (owner-checked server side, score capped by the assignment's points).
import { appError, fail, type Result } from "@/core/data/errors/app-error";
import { toAttachment, type StoredFile } from "@/core/data/supabase/file-upload";
import { db, guard, must } from "@/core/data/supabase/remote";
import type {
  AssignmentSubmission,
  AssignmentSubmissionRepository,
  AssignmentSubmissionStatus,
} from "@/features/instructor/data/assignment-submissions-repository";
import { parseScore } from "@/features/instructor/logic/quiz-validation";

type Sub = {
  student_id: string;
  status: Exclude<AssignmentSubmissionStatus, "missing">;
  submitted_at: string | null;
  submission_text: string | null;
  score: number | null;
  feedback: string | null;
  graded_at: string | null;
  file: StoredFile | null;
};

const SUB_SELECT = "student_id, status, submitted_at, submission_text, score, feedback, graded_at, file:files(id, original_name, kind, size_bytes)";

function row(assignmentId: string, studentId: string, name: string, s: Sub | undefined): AssignmentSubmission {
  return {
    assignmentId,
    studentId,
    studentName: name,
    status: s?.status ?? "missing",
    submittedAt: s?.submitted_at ?? null,
    text: s?.submission_text ?? null,
    file: s?.file ? toAttachment(s.file) : null,
    score: s?.score ?? null,
    feedback: s?.feedback ?? null,
    gradedAt: s?.graded_at ?? null,
  };
}

async function roster(classId: string): Promise<{ id: string; name: string }[]> {
  const rows = must(
    await db().from("class_enrollments").select("student:users!class_enrollments_student_id_fkey(id, full_name)").eq("class_id", classId).is("left_at", null),
  ) as { student: { id: string; full_name: string } | null }[];
  return rows.flatMap((r) => (r.student ? [{ id: r.student.id, name: r.student.full_name }] : []));
}

async function load(classId: string, assignmentId: string): Promise<AssignmentSubmission[] | null> {
  const a = must(await db().from("assignments").select("id").eq("id", assignmentId).eq("class_id", classId).is("deleted_at", null).maybeSingle());
  if (!a) return null;
  const [students, subs] = await Promise.all([
    roster(classId),
    db().from("assignment_submissions").select(SUB_SELECT).eq("assignment_id", assignmentId),
  ]);
  const byStudent = new Map((must(subs) as Sub[]).map((s) => [s.student_id, s]));
  return students.map((u) => row(assignmentId, u.id, u.name, byStudent.get(u.id))).sort((x, y) => x.studentName.localeCompare(y.studentName));
}

export class RemoteAssignmentSubmissionRepository implements AssignmentSubmissionRepository {
  listByAssignment(classId: string, assignmentId: string): Promise<Result<AssignmentSubmission[]>> {
    return guard(async () => (await load(classId, assignmentId)) ?? []);
  }

  get(classId: string, assignmentId: string, studentId: string): Promise<Result<AssignmentSubmission | null>> {
    return guard(async () => (await load(classId, assignmentId))?.find((r) => r.studentId === studentId) ?? null);
  }

  async grade(classId: string, assignmentId: string, studentId: string, scoreInput: string, feedback: string): Promise<Result<AssignmentSubmission>> {
    const a = await guard(async () => must(await db().from("assignments").select("points").eq("id", assignmentId).eq("class_id", classId).maybeSingle()) as { points: number } | null);
    if (!a.ok) return a;
    if (!a.value) return fail(appError("not_found", "This submission no longer exists."));
    const parsed = parseScore(scoreInput, a.value.points);
    if (!parsed.ok) return fail(appError("validation", parsed.error, false));
    return guard(async () => {
      must(await db().rpc("grade_assignment", { p_assignment_id: assignmentId, p_student_id: studentId, p_score: parsed.value, p_feedback: feedback }));
      const got = (await load(classId, assignmentId))?.find((r) => r.studentId === studentId);
      if (!got) throw appError("not_found", "This submission no longer exists.");
      return got;
    }, "The student has not turned this in yet.");
  }
}
