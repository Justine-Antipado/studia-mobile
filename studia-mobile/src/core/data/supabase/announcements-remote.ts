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
  comments: Comment[];
};

type CommentRow = {
  id: string;
  body: string;
  posted_at: string;
  author_id: string | null;
  author: { full_name: string } | null;
};
type AnnRow = {
  id: string;
  class_id: string;
  title: string;
  body: string;
  pinned: boolean;
  posted_at: string;
  comments: CommentRow[];
};

const SELECT =
  "id, class_id, title, body, pinned, posted_at, comments:announcement_comments(id, body, posted_at, author_id, author:users!announcement_comments_author_id_fkey(full_name))";

async function ownerOf(classId: string): Promise<string | null> {
  const row = must(await db().from("classes").select("instructor_id").eq("id", classId).maybeSingle()) as { instructor_id: string } | null;
  return row?.instructor_id ?? null;
}

function toComment(c: CommentRow, ownerId: string | null, me: string): Comment {
  const byOwner = !!c.author_id && c.author_id === ownerId;
  const name = c.author?.full_name;
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

function toView(a: AnnRow, ownerId: string | null, me: string): AnnouncementView {
  return {
    id: a.id,
    classId: a.class_id,
    title: a.title,
    body: a.body,
    postedAt: a.posted_at,
    pinned: a.pinned,
    comments: (a.comments ?? [])
      .sort((x, y) => x.posted_at.localeCompare(y.posted_at))
      .map((c) => toComment(c, ownerId, me)),
  };
}

export function listAnnouncements(classId: string): Promise<Result<AnnouncementView[]>> {
  return guard(async () => {
    const me = await myId();
    const [owner, rows] = await Promise.all([
      ownerOf(classId),
      db().from("announcements").select(SELECT).eq("class_id", classId).is("deleted_at", null).order("posted_at", { ascending: false }),
    ]);
    return (must(rows) as unknown as AnnRow[]).map((a) => toView(a, owner, me));
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
    return a ? toView(a, owner, me) : null;
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
        .select("id, body, posted_at, author_id, author:users!announcement_comments_author_id_fkey(full_name)")
        .single(),
    ]);
    return toComment(must(row) as unknown as CommentRow, owner, me);
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
