// announcements-remote.ts: class stream + comments from Supabase, shared by the student and
// instructor repositories (same rows, RLS decides who may do what).
//   read: class members and owner · post/pin/delete announcement: owner · comment: members and owner
//   delete a comment: its author, or the class owner
import { appError, fail, ok, type Result } from "@/core/data/errors/app-error";
import { db, guard, must, mustOk, myId } from "@/core/data/supabase/remote";
import type { Comment } from "@/core/types/content";

export type AnnouncementView = {
  id: string;
  classId: string;
  title: string;
  body: string;
  postedAt: string;
  pinned: boolean;
  /** The instructor who posted it; null if their account no longer exists. */
  authorId: string | null;
  authorName: string;
  comments: Comment[];
};

type CommentRow = {
  id: string;
  body: string;
  posted_at: string;
  author_id: string | null;
};
type AnnRow = {
  id: string;
  class_id: string;
  title: string;
  body: string;
  pinned: boolean;
  posted_at: string;
  author_id: string | null;
  comments: CommentRow[];
};

const SELECT =
  "id, class_id, title, body, pinned, posted_at, author_id, comments:announcement_comments(id, body, posted_at, author_id)";
const COMMENT_SELECT = "id, body, posted_at, author_id";

async function ownerOf(classId: string): Promise<string | null> {
  const row = must(await db().from("classes").select("instructor_id").eq("id", classId).maybeSingle()) as { instructor_id: string } | null;
  return row?.instructor_id ?? null;
}

/**
 * Display names of the comment authors, from `person_names` (migration 031).
 *
 * The author's name is NOT embedded in the announcement query any more: the row policy that allowed
 * a student to read a classmate's `users` row also exposed that classmate's email and phone, so it
 * was dropped. `person_names` returns the name alone, for the people the caller studies with. An id
 * it does not answer for (someone who has left the class, a deleted account) falls back to the
 * generic label in `toComment`, exactly as a missing name did before.
 */
const NAME_BATCH = 200; // person_names answers for at most 200 ids per call

async function namesOf(ids: readonly (string | null)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => !!id)));
  const out = new Map<string, string>();
  for (let i = 0; i < unique.length; i += NAME_BATCH) {
    const rows = (must(await db().rpc("person_names", { p_ids: unique.slice(i, i + NAME_BATCH) })) ?? []) as {
      id: string;
      name: string;
    }[];
    for (const r of rows) out.set(r.id, r.name);
  }
  return out;
}

function toComment(c: CommentRow, ownerId: string | null, me: string, names: Map<string, string>): Comment {
  const byOwner = !!c.author_id && c.author_id === ownerId;
  const name = c.author_id ? names.get(c.author_id) : undefined;
  return {
    id: c.id,
    author: name ? (byOwner ? `Prof. ${name}` : name) : byOwner ? "Instructor" : "Classmate",
    authorId: c.author_id,
    authorIsMe: c.author_id === me,
    authorIsInstructor: byOwner,
    text: c.body,
    postedAt: c.posted_at,
  };
}

function toView(a: AnnRow, ownerId: string | null, me: string, names: Map<string, string>): AnnouncementView {
  return {
    id: a.id,
    classId: a.class_id,
    title: a.title,
    body: a.body,
    postedAt: a.posted_at,
    pinned: a.pinned,
    authorId: a.author_id,
    authorName: (a.author_id ? names.get(a.author_id) : undefined) ?? "Instructor",
    comments: (a.comments ?? [])
      .sort((x, y) => x.posted_at.localeCompare(y.posted_at))
      .map((c) => toComment(c, ownerId, me, names)),
  };
}

const authorIds = (rows: readonly AnnRow[]): (string | null)[] =>
  rows.flatMap((a) => [a.author_id, ...(a.comments ?? []).map((c) => c.author_id)]);

export function listAnnouncements(classId: string): Promise<Result<AnnouncementView[]>> {
  return guard(async () => {
    const me = await myId();
    const [owner, rows] = await Promise.all([
      ownerOf(classId),
      // Pinned first, then newest: a pinned announcement must never end up buried under later
      // posts (B2). The Stream still renders it in its own section.
      db()
        .from("announcements")
        .select(SELECT)
        .eq("class_id", classId)
        .is("deleted_at", null)
        .order("pinned", { ascending: false })
        .order("posted_at", { ascending: false }),
    ]);
    const list = must(rows) as unknown as AnnRow[];
    // One round trip for every author on the screen, after the rows are in.
    const names = await namesOf(authorIds(list));
    return list.map((a) => toView(a, owner, me, names));
  });
}

export function getAnnouncement(classId: string, id: string): Promise<Result<AnnouncementView | null>> {
  return guard(async () => {
    const me = await myId();
    const [owner, row] = await Promise.all([
      ownerOf(classId),
      db().from("announcements").select(SELECT).eq("id", id).eq("class_id", classId).is("deleted_at", null).maybeSingle(),
    ]);
    const a = must(row) as unknown as AnnRow | null;
    if (!a) return null;
    return toView(a, owner, me, await namesOf(authorIds([a])));
  });
}

export function createAnnouncement(
  classId: string,
  input: { title: string; body: string; pinned: boolean },
): Promise<Result<AnnouncementView>> {
  return guard(async () => {
    const me = await myId();
    const row = must(
      await db()
        .from("announcements")
        .insert({ class_id: classId, author_id: me, title: input.title.trim(), body: input.body.trim(), pinned: input.pinned })
        .select("id")
        .single(),
    ) as { id: string };
    const got = await getAnnouncement(classId, row.id);
    if (!got.ok) throw got.error;
    if (!got.value) throw appError("not_found", "This announcement no longer exists.");
    return got.value;
  }, "This class no longer exists.");
}

export function removeAnnouncement(classId: string, id: string): Promise<Result<void>> {
  return guard(async () => {
    mustOk(await db().from("announcements").delete().eq("id", id).eq("class_id", classId));
  }, "This announcement no longer exists.");
}

export function addComment(classId: string, id: string, text: string): Promise<Result<Comment>> {
  return guard(async () => {
    const me = await myId();
    const [owner, row] = await Promise.all([
      ownerOf(classId),
      db()
        .from("announcement_comments")
        .insert({ announcement_id: id, author_id: me, body: text.trim() })
        .select(COMMENT_SELECT)
        .single(),
    ]);
    const c = must(row) as unknown as CommentRow;
    // The author is the caller, and person_names always answers for the caller themselves.
    return toComment(c, owner, me, await namesOf([c.author_id]));
  }, "This announcement no longer exists.");
}

export async function deleteComment(commentId: string): Promise<Result<void>> {
  const res = await guard(async () => {
    const rows = must(await db().from("announcement_comments").delete().eq("id", commentId).select("id"));
    return rows.length;
  }, "This comment no longer exists.");
  if (!res.ok) return res;
  return res.value > 0 ? ok(undefined) : fail(appError("not_found", "This comment no longer exists."));
}
