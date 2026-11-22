// students-remote.ts: class roster for the instructor. Progress comes from the class_progress view;
// submitted / pending counts come from real assignment submissions. "Remove" sets left_at.
import { appError, type Result } from "@/core/data/errors/app-error";
import { db, guard, must, mustOk, sectionLabel } from "@/core/data/supabase/remote";
import type { ClassStudentRepository } from "@/features/instructor/data/students-repository";
import type { ClassStudent } from "@/features/instructor/types/instructor";

type Enr = { student: { id: string; full_name: string; email: string } | null };

async function load(classId: string): Promise<ClassStudent[]> {
  const cls = must(await db().from("classes").select("course, year_level, section").eq("id", classId).maybeSingle()) as { course: string; year_level: string; section: string } | null;
  if (!cls) return [];
  const [enr, prog, asg] = await Promise.all([
    db().from("class_enrollments").select("student:users!class_enrollments_student_id_fkey(id, full_name, email)").eq("class_id", classId).is("left_at", null),
    db().from("class_progress").select("student_id, progress_pct").eq("class_id", classId),
    db().from("assignments").select("id").eq("class_id", classId).is("deleted_at", null),
  ]);
  const students = (must(enr) as Enr[]).flatMap((e) => (e.student ? [e.student] : []));
  const progress = new Map((must(prog) as { student_id: string; progress_pct: number | null }[]).map((p) => [p.student_id, (p.progress_pct ?? 0) / 100]));
  const assignmentIds = (must(asg) as { id: string }[]).map((a) => a.id);
  const submitted = new Map<string, number>();
  if (assignmentIds.length) {
    const subs = must(await db().from("assignment_submissions").select("student_id").in("assignment_id", assignmentIds).neq("status", "draft")) as { student_id: string }[];
    subs.forEach((s) => submitted.set(s.student_id, (submitted.get(s.student_id) ?? 0) + 1));
  }
  const section = sectionLabel(cls.course, cls.year_level, cls.section);
  return students
    .map<ClassStudent>((u) => ({
      id: u.id,
      name: u.full_name,
      email: u.email,
      section,
      progress: progress.get(u.id) ?? 0,
      submittedCount: submitted.get(u.id) ?? 0,
      pendingCount: assignmentIds.length - (submitted.get(u.id) ?? 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export class RemoteClassStudentRepository implements ClassStudentRepository {
  listByClass(classId: string): Promise<Result<ClassStudent[]>> {
    return guard(() => load(classId));
  }

  get(classId: string, studentId: string): Promise<Result<ClassStudent | null>> {
    return guard(async () => (await load(classId)).find((s) => s.id === studentId) ?? null);
  }

  remove(classId: string, studentId: string): Promise<Result<void>> {
    return guard(async () => {
      const rows = must(
        await db().from("class_enrollments").update({ left_at: new Date().toISOString() }).eq("class_id", classId).eq("student_id", studentId).is("left_at", null).select("id"),
      ) as unknown[];
      if (rows.length === 0) throw appError("not_found", "This student is not in the class.");
      mustOk({ error: null });
    });
  }
}
