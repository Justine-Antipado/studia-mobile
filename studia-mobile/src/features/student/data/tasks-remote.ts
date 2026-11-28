// tasks-remote.ts: the student to-do. The item list comes from the `student_tasks` view (assignments
// + published quizzes of joined classes); completion is read straight from the student's own
// submissions — the same rows the assignment and quiz screens show — so a turned-in assignment or a
// submitted quiz is checked everywhere, without trusting a derived column. A manual tick is a row in
// student_task_overrides, only written for items not already completed by a submission.
import { appError, fail, ok, type Result } from "@/core/data/errors/app-error";
import { db, guard, must, myId } from "@/core/data/supabase/remote";
import type { TaskRepository } from "@/features/student/data/tasks-repository";
import type { Task, TaskKind } from "@/features/student/types/student";

type Row = { kind: TaskKind; ref_id: string; class_id: string; title: string; due_at: string | null };

export const taskId = (kind: TaskKind, refId: string) => `${kind === "assignment" ? "task_as_" : "task_qz_"}${refId}`;

async function loadTasks(): Promise<Task[]> {
  const me = await myId();
  const [taskRes, tickRes, turnedInRes, attemptRes] = await Promise.all([
    db().from("student_tasks").select("kind, ref_id, class_id, title, due_at").eq("student_id", me),
    db().from("student_task_overrides").select("kind, ref_id").eq("student_id", me).eq("done", true),
    db().from("assignment_submissions").select("assignment_id").eq("student_id", me).neq("status", "draft"),
    db().from("quiz_attempts").select("quiz_id").eq("student_id", me).not("submitted_at", "is", null),
  ]);
  const rows = must(taskRes) as Row[];
  const ticked = new Set((must(tickRes) as { kind: TaskKind; ref_id: string }[]).map((t) => taskId(t.kind, t.ref_id)));
  const submitted = new Set([
    ...(must(turnedInRes) as { assignment_id: string }[]).map((s) => taskId("assignment", s.assignment_id)),
    ...(must(attemptRes) as { quiz_id: string }[]).map((a) => taskId("quiz", a.quiz_id)),
  ]);
  const dated = rows.filter((r) => r.due_at);
  const classIds = [...new Set(dated.map((r) => r.class_id))];
  const codes = new Map<string, string>();
  if (classIds.length) {
    const classes = must(await db().from("classes").select("id, subject_code").in("id", classIds)) as { id: string; subject_code: string }[];
    classes.forEach((c) => codes.set(c.id, c.subject_code));
  }
  return dated
    .map<Task>((r) => {
      const id = taskId(r.kind, r.ref_id);
      const isSubmitted = submitted.has(id);
      return {
        id,
        kind: r.kind,
        classId: r.class_id,
        classCode: codes.get(r.class_id) ?? "",
        refId: r.ref_id,
        title: r.title,
        dueAt: r.due_at!,
        done: isSubmitted || ticked.has(id),
        submitted: isSubmitted,
      };
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export class RemoteTaskRepository implements TaskRepository {
  list(): Promise<Result<Task[]>> {
    return guard(loadTasks);
  }

  async toggleDone(id: string): Promise<Result<Task>> {
    const all = await this.list();
    if (!all.ok) return all;
    const task = all.value.find((t) => t.id === id);
    if (!task) return fail(appError("not_found", "This task no longer exists."));
    // A stale screen may still show a submitted task as open; it is already done, nothing to write.
    if (task.submitted) return ok(task);
    const res = await guard(async () => {
      const me = await myId();
      const next = !task.done;
      must(
        await db()
          .from("student_task_overrides")
          .upsert({ student_id: me, kind: task.kind, ref_id: task.refId, done: next }, { onConflict: "student_id,kind,ref_id" }),
      );
      return next;
    });
    return res.ok ? ok({ ...task, done: res.value }) : res;
  }
}
