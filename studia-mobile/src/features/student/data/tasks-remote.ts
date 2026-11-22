// tasks-remote.ts: the student to-do from the `student_tasks` view (assignments + published quizzes
// of joined classes; "done" is derived from real submissions). A manual tick is a row in
// student_task_overrides, only allowed for items not already completed by a submission.
import { appError, fail, ok, type Result } from "@/core/data/errors/app-error";
import { db, guard, must, myId } from "@/core/data/supabase/remote";
import type { TaskRepository } from "@/features/student/data/tasks-repository";
import type { Task, TaskKind } from "@/features/student/types/student";

type Row = { kind: TaskKind; ref_id: string; class_id: string; title: string; due_at: string | null; done: boolean };

export const taskId = (kind: TaskKind, refId: string) => `${kind === "assignment" ? "task_as_" : "task_qz_"}${refId}`;

async function loadTasks(): Promise<Task[]> {
  const me = await myId();
  const rows = must(await db().from("student_tasks").select("kind, ref_id, class_id, title, due_at, done").eq("student_id", me)) as Row[];
  const dated = rows.filter((r) => r.due_at);
  const classIds = [...new Set(dated.map((r) => r.class_id))];
  const codes = new Map<string, string>();
  if (classIds.length) {
    const classes = must(await db().from("classes").select("id, subject_code").in("id", classIds)) as { id: string; subject_code: string }[];
    classes.forEach((c) => codes.set(c.id, c.subject_code));
  }
  return dated
    .map<Task>((r) => ({
      id: taskId(r.kind, r.ref_id),
      kind: r.kind,
      classId: r.class_id,
      classCode: codes.get(r.class_id) ?? "",
      refId: r.ref_id,
      title: r.title,
      dueAt: r.due_at!,
      done: r.done,
    }))
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
    const res = await guard(async () => {
      const me = await myId();
      const override = must(
        await db().from("student_task_overrides").select("done").eq("student_id", me).eq("kind", task.kind).eq("ref_id", task.refId).maybeSingle(),
      ) as { done: boolean } | null;
      if (task.done && !override?.done) throw appError("conflict", "Already completed via submission.", false);
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
