// assignments-remote.ts: student assignments from Supabase. Turning in goes through the
// submit_assignment RPC, which applies the due / late / closed rules with the DATABASE clock.
import { appError, fail, type Result } from "@/core/data/errors/app-error";
import { isPicked, toAttachment, uploadPicked, type StoredFile } from "@/core/data/supabase/file-upload";
import { db, guard, must, myId } from "@/core/data/supabase/remote";
import type { AssignmentRepository } from "@/features/student/data/assignments-repository";
import type { Assignment, Attachment, SubmissionStatus } from "@/features/student/types/student";

const FILE = "id, original_name, kind, size_bytes";
const SELECT = `id, class_id, title, instructions, due_at, points, allow_late, attachments:assignment_attachments(position, file:files(${FILE}))`;

type Row = {
  id: string;
  class_id: string;
  title: string;
  instructions: string;
  due_at: string;
  points: number;
  allow_late: boolean;
  attachments: { position: number; file: StoredFile | null }[];
};
type Sub = {
  assignment_id: string;
  status: SubmissionStatus;
  submitted_at: string | null;
  submission_text: string | null;
  score: number | null;
  feedback: string | null;
  file: StoredFile | null;
};

function toAssignment(a: Row, s: Sub | undefined): Assignment {
  return {
    id: a.id,
    classId: a.class_id,
    title: a.title,
    instructions: a.instructions,
    dueAt: a.due_at,
    points: a.points,
    allowLate: a.allow_late,
    attachments: [...(a.attachments ?? [])]
      .sort((x, y) => x.position - y.position)
      .flatMap((x) => (x.file ? [toAttachment(x.file)] : [])),
    status: s?.status ?? "assigned",
    submittedAt: s?.submitted_at ?? null,
    submissionText: s?.submission_text ?? null,
    submissionFile: s?.file ? toAttachment(s.file) : null,
    score: s?.status === "graded" ? s.score : null,
    feedback: s?.status === "graded" ? s.feedback : null,
  };
}

async function load(classId: string, id: string | null): Promise<Assignment[]> {
  const me = await myId();
  let q = db().from("assignments").select(SELECT).eq("class_id", classId).is("deleted_at", null).order("due_at");
  if (id) q = q.eq("id", id);
  const rows = must(await q) as Row[];
  if (rows.length === 0) return [];
  const subs = must(
    await db()
      .from("assignment_submissions")
      .select(`assignment_id, status, submitted_at, submission_text, score, feedback, file:files(${FILE})`)
      .eq("student_id", me)
      .in("assignment_id", rows.map((r) => r.id)),
  ) as Sub[];
  const byId = new Map(subs.map((s) => [s.assignment_id, s]));
  return rows.map((r) => toAssignment(r, byId.get(r.id)));
}

export class RemoteAssignmentRepository implements AssignmentRepository {
  listByClass(classId: string): Promise<Result<Assignment[]>> {
    return guard(() => load(classId, null));
  }

  get(classId: string, id: string): Promise<Result<Assignment | null>> {
    return guard(async () => (await load(classId, id))[0] ?? null);
  }

  attach(classId: string, id: string, input: { text: string; file: Attachment | null }): Promise<Result<Assignment>> {
    return guard(async () => {
      const fileId = input.file && isPicked(input.file) ? await uploadPicked(input.file, "submissions") : null;
      must(await db().rpc("submit_assignment", { p_assignment_id: id, p_text: input.text, p_file_id: fileId, p_turn_in: true }));
      const a = (await load(classId, id))[0];
      if (!a) throw appError("not_found", "This assignment no longer exists.");
      return a;
    }, "This assignment no longer exists.");
  }

  async turnIn(classId: string, id: string): Promise<Result<Assignment>> {
    const res = await guard(async () => {
      const current = (await load(classId, id))[0];
      if (!current) throw appError("not_found", "This assignment no longer exists.");
      if (current.status !== "draft") throw appError("conflict", "Nothing to turn in.", false);
      must(await db().rpc("submit_assignment", { p_assignment_id: id, p_text: null, p_file_id: null, p_turn_in: true }));
      return (await load(classId, id))[0]!;
    });
    if (res.ok && res.value.status === "draft") {
      return fail(appError("conflict", "The deadline has passed and late work isn't allowed. Ask your instructor to reopen it.", false));
    }
    return res;
  }
}
