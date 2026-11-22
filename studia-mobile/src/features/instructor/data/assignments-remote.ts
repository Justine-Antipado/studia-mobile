// assignments-remote.ts: instructor-authored assignments in Supabase. Students are notified by a
// database trigger; the points/due-date edit rules are enforced by DB triggers too (this file
// only adds a friendlier pre-check message).
import { appError, fail, type Result } from "@/core/data/errors/app-error";
import { isPicked, toAttachment, uploadPicked, type StoredFile } from "@/core/data/supabase/file-upload";
import { db, guard, must, mustOk, myId } from "@/core/data/supabase/remote";
import type { AssignmentDraft, InstructorAssignmentRepository } from "@/features/instructor/data/assignments-repository";
import type { InstructorAssignment } from "@/features/instructor/types/instructor";

const SELECT =
  "id, class_id, title, instructions, due_at, points, allow_late, created_at, attachments:assignment_attachments(position, file:files(id, original_name, kind, size_bytes))";

type Row = {
  id: string;
  class_id: string;
  title: string;
  instructions: string;
  due_at: string;
  points: number;
  allow_late: boolean;
  created_at: string;
  attachments: { position: number; file: StoredFile | null }[];
};

const toAssignment = (r: Row): InstructorAssignment => ({
  id: r.id,
  classId: r.class_id,
  title: r.title,
  instructions: r.instructions,
  dueAt: r.due_at,
  points: r.points,
  allowLate: r.allow_late,
  createdAt: r.created_at,
  attachments: [...r.attachments].sort((a, b) => a.position - b.position).flatMap((x) => (x.file ? [toAttachment(x.file)] : [])),
});

async function fetchOne(classId: string, id: string): Promise<InstructorAssignment | null> {
  const row = must(await db().from("assignments").select(SELECT).eq("id", id).eq("class_id", classId).is("deleted_at", null).maybeSingle()) as Row | null;
  return row ? toAssignment(row) : null;
}

async function syncAttachments(assignmentId: string, draft: AssignmentDraft["attachments"]): Promise<void> {
  const existing = must(await db().from("assignment_attachments").select("file_id").eq("assignment_id", assignmentId)) as { file_id: string }[];
  const have = new Set(existing.map((e) => e.file_id));
  const keep = new Set<string>();
  const rows: { assignment_id: string; file_id: string; position: number }[] = [];
  for (let i = 0; i < draft.length; i++) {
    const a = draft[i]!;
    const fileId = isPicked(a) ? await uploadPicked(a, "materials") : a.id;
    keep.add(fileId);
    if (!have.has(fileId)) rows.push({ assignment_id: assignmentId, file_id: fileId, position: i });
  }
  const drop = [...have].filter((f) => !keep.has(f));
  if (drop.length) mustOk(await db().from("assignment_attachments").delete().eq("assignment_id", assignmentId).in("file_id", drop));
  if (rows.length) mustOk(await db().from("assignment_attachments").insert(rows));
}

export class RemoteInstructorAssignmentRepository implements InstructorAssignmentRepository {
  listByClass(classId: string): Promise<Result<InstructorAssignment[]>> {
    return guard(async () => {
      const rows = must(await db().from("assignments").select(SELECT).eq("class_id", classId).is("deleted_at", null).order("due_at")) as Row[];
      return rows.map(toAssignment);
    });
  }

  get(classId: string, id: string): Promise<Result<InstructorAssignment | null>> {
    return guard(() => fetchOne(classId, id));
  }

  create(classId: string, draft: AssignmentDraft): Promise<Result<InstructorAssignment>> {
    return guard(async () => {
      const me = await myId();
      const row = must(
        await db()
          .from("assignments")
          .insert({
            class_id: classId,
            title: draft.title.trim(),
            instructions: draft.instructions.trim(),
            due_at: draft.dueAt,
            points: draft.points,
            allow_late: draft.allowLate,
            created_by: me,
          })
          .select("id")
          .single(),
      ) as { id: string };
      await syncAttachments(row.id, draft.attachments);
      const made = await fetchOne(classId, row.id);
      if (!made) throw appError("not_found", "This class no longer exists.");
      return made;
    }, "This class no longer exists.");
  }

  async update(classId: string, id: string, draft: AssignmentDraft): Promise<Result<InstructorAssignment>> {
    const top = await guard(async () => {
      const rows = must(await db().from("assignment_submissions").select("score").eq("assignment_id", id).not("score", "is", null).order("score", { ascending: false }).limit(1)) as { score: number }[];
      return rows[0]?.score ?? 0;
    });
    if (top.ok && draft.points < top.value) {
      return fail(appError("validation", `A student already scored ${top.value}. Points can't be lower than that.`, false));
    }
    return guard(async () => {
      mustOk(
        await db()
          .from("assignments")
          .update({ title: draft.title.trim(), instructions: draft.instructions.trim(), due_at: draft.dueAt, points: draft.points, allow_late: draft.allowLate })
          .eq("id", id)
          .eq("class_id", classId),
      );
      await syncAttachments(id, draft.attachments);
      const next = await fetchOne(classId, id);
      if (!next) throw appError("not_found", "This assignment no longer exists.");
      return next;
    }, "This assignment no longer exists.");
  }

  remove(classId: string, id: string): Promise<Result<void>> {
    return guard(async () => {
      mustOk(await db().from("assignments").delete().eq("id", id).eq("class_id", classId));
    }, "This assignment no longer exists.");
  }
}
