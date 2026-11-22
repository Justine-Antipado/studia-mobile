// mock-announcements.ts — shared read/write logic for announcements + comments over the mock DB.
// Student and instructor repositories call these with their own `viewerId`, so the same comment
// is "mine" (deletable) for its author and labelled "Instructor" for everyone when it was written
// by the class owner. Permission rules mirror the RLS the real backend enforces:
//   - read: class members and the class owner
//   - comment: class members and the class owner
//   - delete a comment: its author, or the class owner (moderation)
//   - post / delete an announcement: the class owner only
import { dbId, mockDb, type DbAnnouncement, type DbComment } from "@/core/data/mock/mock-db";
import { classCodeOf, nameOf, notify, studentIdsOf } from "@/core/data/mock/mock-notifications";
import type { Comment } from "@/core/types/content";
import { mockNowIso } from "@/core/data/mock/mock-clock";

export type AnnouncementView = {
  id: string;
  classId: string;
  title: string;
  body: string;
  postedAt: string;
  pinned: boolean;
  comments: Comment[];
};

export const isOwner = (classId: string, userId: string) => mockDb.cls(classId)?.ownerId === userId;
export const canAccess = (classId: string, userId: string) =>
  isOwner(classId, userId) || mockDb.isEnrolled(classId, userId);

function toComment(c: DbComment, classId: string, viewerId: string): Comment {
  const author = mockDb.user(c.authorId);
  const byOwner = isOwner(classId, c.authorId);
  return {
    id: c.id,
    author: author ? (byOwner ? `Prof. ${author.name}` : author.name) : "Former member",
    authorIsMe: c.authorId === viewerId,
    authorIsInstructor: byOwner,
    text: c.text,
    postedAt: c.postedAt,
  };
}

function toView(a: DbAnnouncement, viewerId: string): AnnouncementView {
  return {
    id: a.id,
    classId: a.classId,
    title: a.title,
    body: a.body,
    postedAt: a.postedAt,
    pinned: a.pinned,
    comments: mockDb.comments
      .filter((c) => c.announcementId === a.id)
      .sort((x, y) => x.postedAt.localeCompare(y.postedAt))
      .map((c) => toComment(c, a.classId, viewerId)),
  };
}

export function listAnnouncements(classId: string, viewerId: string): AnnouncementView[] {
  if (!canAccess(classId, viewerId)) return [];
  return mockDb.announcements
    .filter((a) => a.classId === classId)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .map((a) => toView(a, viewerId));
}

export function getAnnouncement(classId: string, id: string, viewerId: string): AnnouncementView | null {
  if (!canAccess(classId, viewerId)) return null;
  const a = mockDb.announcements.find((x) => x.classId === classId && x.id === id);
  return a ? toView(a, viewerId) : null;
}

export function createAnnouncement(
  classId: string,
  authorId: string,
  input: { title: string; body: string; pinned: boolean },
): AnnouncementView | null {
  if (!isOwner(classId, authorId)) return null;
  const a: DbAnnouncement = {
    id: dbId("an"),
    classId,
    authorId,
    title: input.title.trim(),
    body: input.body.trim(),
    postedAt: mockNowIso(),
    pinned: input.pinned,
  };
  mockDb.announcements = [a, ...mockDb.announcements];
  mockDb.emit();
  notify(studentIdsOf(classId), { tag: "Notice", title: a.title, meta: classCodeOf(classId), body: a.body.slice(0, 280) }, authorId);
  return toView(a, authorId);
}

export function removeAnnouncement(classId: string, id: string, userId: string): boolean {
  const a = mockDb.announcements.find((x) => x.classId === classId && x.id === id);
  if (!a || !isOwner(classId, userId)) return false;
  mockDb.announcements = mockDb.announcements.filter((x) => x.id !== id);
  mockDb.comments = mockDb.comments.filter((c) => c.announcementId !== id);
  mockDb.emit();
  return true;
}

export function addComment(classId: string, id: string, userId: string, text: string): Comment | null {
  const a = mockDb.announcements.find((x) => x.classId === classId && x.id === id);
  if (!a || !canAccess(classId, userId)) return null;
  const c: DbComment = { id: dbId("c"), announcementId: id, authorId: userId, text, postedAt: mockNowIso() };
  mockDb.comments = [...mockDb.comments, c];
  mockDb.emit();
  // The author of the post and everyone who already commented hear about the new comment.
  const audience = [a.authorId, ...mockDb.comments.filter((x) => x.announcementId === id).map((x) => x.authorId)];
  notify(
    audience,
    { tag: "Class", title: `New comment on "${a.title}"`, meta: `${nameOf(userId)} · ${classCodeOf(classId)}`, body: text.slice(0, 280) },
    userId,
  );
  return toComment(c, classId, userId);
}

export type DeleteCommentOutcome = "ok" | "not_found" | "forbidden";

export function deleteComment(classId: string, id: string, commentId: string, userId: string): DeleteCommentOutcome {
  const c = mockDb.comments.find((x) => x.id === commentId && x.announcementId === id);
  const a = mockDb.announcements.find((x) => x.classId === classId && x.id === id);
  if (!c || !a || !canAccess(classId, userId)) return "not_found";
  if (c.authorId !== userId && !isOwner(classId, userId)) return "forbidden";
  mockDb.comments = mockDb.comments.filter((x) => x.id !== commentId);
  mockDb.emit();
  return "ok";
}
