// tasks-remote.ts: the student to-do. The item list comes from the `student_tasks` view (assignments
// + published quizzes of joined classes); completion is read straight from the student's own
// submissions — the same rows the assignment and quiz screens show — so a turned-in (even late)
// assignment or a submitted quiz is checked everywhere. Tasks cannot be ticked by hand.
import type { Result } from "@/core/data/errors/app-error";
import { db, guard, must, myId } from "@/core/data/supabase/remote";
import type { TaskRepository } from "@/features/student/data/tasks-repository";
import type { Task, TaskKind } from "@/features/student/types/student";

type Row = { kind: TaskKind; ref_id: string; class_id: string; title: string; due_at: string | null };

export const taskId = (kind: TaskKind, refId: string) => `${kind === "assignment" ? "task_as_" : "task_qz_"}${refId}`;

async function loadTasks(): Promise<Task[]> {
  const me = await myId();
  const [taskRes, turnedInRes, attemptRes] = await Promise.all([
    db().from("student_tasks").select("kind, ref_id, class_id, title, due_at").eq("student_id", me),
    db().from("assignment_submissions").select("assignment_id").eq("student_id", me).neq("status", "draft"),
    db().from("quiz_attempts").select("quiz_id").eq("student_id", me).not("submitted_at", "is", null),
  ]);
  const rows = must(taskRes) as Row[];
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
        done: isSubmitted,
        submitted: isSubmitted,
      };
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export class RemoteTaskRepository implements TaskRepository {
  list(): Promise<Result<Task[]>> {
    return guard(loadTasks);
  }
}
