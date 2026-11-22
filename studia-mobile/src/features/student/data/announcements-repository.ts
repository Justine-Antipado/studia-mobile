// announcements-repository.ts — student view of a class stream + comments. Announcements are the
// instructor's rows; a comment written here is visible to the instructor and classmates. Same shape
// as docs/api-contract.md.
import type { Result } from "@/core/data/errors/app-error";
import * as remote from "@/core/data/supabase/announcements-remote";
import type { Announcement, Comment } from "@/features/student/types/student";

export interface AnnouncementRepository {
  listByClass(classId: string): Promise<Result<Announcement[]>>;
  get(classId: string, id: string): Promise<Result<Announcement | null>>;
  addComment(classId: string, id: string, text: string): Promise<Result<Comment>>;
  deleteComment(classId: string, id: string, commentId: string): Promise<Result<void>>;
}

class RemoteAnnouncementRepository implements AnnouncementRepository {
  listByClass = (classId: string) => remote.listAnnouncements(classId);
  get = (classId: string, id: string) => remote.getAnnouncement(classId, id);
  addComment = (classId: string, id: string, text: string) => remote.addComment(classId, id, text);
  deleteComment = (_classId: string, _id: string, commentId: string) => remote.deleteComment(commentId);
}

export const announcementRepository: AnnouncementRepository = new RemoteAnnouncementRepository();
