// announcements-repository.ts — instructor view: post, pin, comment and moderate comments.
// Posts show up in the students' Stream.
import type { Result } from "@/core/data/errors/app-error";
import * as remote from "@/core/data/supabase/announcements-remote";
import type { Announcement, Comment } from "@/features/instructor/types/instructor";

export interface InstructorAnnouncementRepository {
  listByClass(classId: string): Promise<Result<Announcement[]>>;
  get(classId: string, id: string): Promise<Result<Announcement | null>>;
  create(classId: string, input: { title: string; body: string; pinned: boolean }): Promise<Result<Announcement>>;
  addComment(classId: string, id: string, text: string): Promise<Result<Comment>>;
  deleteComment(classId: string, id: string, commentId: string): Promise<Result<void>>;
  remove(classId: string, id: string): Promise<Result<void>>;
}

class RemoteInstructorAnnouncementRepository implements InstructorAnnouncementRepository {
  listByClass = (classId: string) => remote.listAnnouncements(classId);
  get = (classId: string, id: string) => remote.getAnnouncement(classId, id);
  create = (classId: string, input: { title: string; body: string; pinned: boolean }) => remote.createAnnouncement(classId, input);
  addComment = (classId: string, id: string, text: string) => remote.addComment(classId, id, text);
  deleteComment = (_classId: string, _id: string, commentId: string) => remote.deleteComment(commentId);
  remove = (classId: string, id: string) => remote.removeAnnouncement(classId, id);
}

export const instructorAnnouncementRepository: InstructorAnnouncementRepository = new RemoteInstructorAnnouncementRepository();
