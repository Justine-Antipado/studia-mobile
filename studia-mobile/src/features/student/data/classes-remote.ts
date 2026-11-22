// classes-remote.ts: student classes from Supabase. RLS already limits `classes` to the ones the
// student is enrolled in; joining/leaving go through the join_class / leave_class RPCs.
import { appError, fail, type Result } from "@/core/data/errors/app-error";
import { db, guard, must, mustOk, myId, sectionLabel } from "@/core/data/supabase/remote";
import type { ClassRepository } from "@/features/student/data/classes-repository";
import type { Person, StudentClass } from "@/features/student/types/student";

const COLS = "id, subject_code, title, course, year_level, section, instructor:users!classes_instructor_id_fkey(full_name)";

type Row = {
  id: string;
  subject_code: string;
  title: string;
  course: string;
  year_level: string;
  section: string;
  instructor: { full_name: string } | null;
};

async function progressMap(studentId: string, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = must(await db().from("class_progress").select("class_id, progress_pct").eq("student_id", studentId).in("class_id", ids));
  return new Map(rows.map((r: { class_id: string; progress_pct: number | null }) => [r.class_id, (r.progress_pct ?? 0) / 100]));
}

const toClass = (r: Row, progress: number): StudentClass => ({
  id: r.id,
  code: r.subject_code,
  title: r.title,
  section: sectionLabel(r.course, r.year_level, r.section),
  teacher: `Prof. ${r.instructor?.full_name ?? "Instructor"}`,
  progress,
});

export class RemoteClassRepository implements ClassRepository {
  list(): Promise<Result<StudentClass[]>> {
    return guard(async () => {
      const me = await myId();
      const rows = must(await db().from("classes").select(COLS).eq("archived", false).order("created_at", { ascending: false })) as unknown as Row[];
      const prog = await progressMap(me, rows.map((r) => r.id));
      return rows.map((r) => toClass(r, prog.get(r.id) ?? 0));
    });
  }

  get(id: string): Promise<Result<StudentClass | null>> {
    return guard(async () => {
      const me = await myId();
      const row = must(await db().from("classes").select(COLS).eq("id", id).eq("archived", false).maybeSingle()) as unknown as Row | null;
      if (!row) return null;
      const prog = await progressMap(me, [id]);
      return toClass(row, prog.get(id) ?? 0);
    });
  }

  async joinByCode(code: string): Promise<Result<StudentClass>> {
    const joined = await guard(async () => must(await db().rpc("join_class", { p_code: code.trim().toUpperCase() })) as string, "No class matches that code. Check it and try again.");
    if (!joined.ok) return joined;
    const cls = await this.get(joined.value);
    if (!cls.ok) return cls;
    return cls.value ? { ok: true, value: cls.value } : fail(appError("not_found", "No class matches that code. Check it and try again."));
  }

  classmates(id: string): Promise<Result<Person[]>> {
    return guard(async () => {
      const rows = must(await db().rpc("class_classmates", { p_class_id: id })) as { id: string; full_name: string }[];
      return rows.map((r) => ({ id: r.id, name: r.full_name, role: "student" as const }));
    });
  }

  leave(id: string): Promise<Result<void>> {
    return guard(async () => {
      mustOk(await db().rpc("leave_class", { p_class_id: id }));
    });
  }
}
