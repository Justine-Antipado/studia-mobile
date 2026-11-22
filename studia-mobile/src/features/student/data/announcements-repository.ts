// announcements-repository.ts — student view over the shared mock DB (class stream + comments).
// Announcements are the instructor's rows, so what is posted there appears here; a comment written
// here is visible to the instructor and classmates. Same shape the real API returns per
// docs/api-contract.md.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { isRemote } from "@/core/config/data-source";
import * as remote from "@/core/data/supabase/announcements-remote";
import { ME } from "@/core/data/mock/mock-db";
import {
  addComment,
  deleteComment,
  getAnnouncement,
  listAnnouncements,
} from "@/core/data/mock/mock-announcements";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { Announcement, Comment } from "@/features/student/types/student";

export interface AnnouncementRepository {
  listByClass(classId: string): Promise<Result<Announcement[]>>;
  get(classId: string, id: string): Promise<Result<Announcement | null>>;
  addComment(classId: string, id: string, text: string): Promise<Result<Comment>>;
  deleteComment(classId: string, id: string, commentId: string): Promise<Result<void>>;
}

class MockAnnouncementRepository implements AnnouncementRepository {
  listByClass(classId: string): Promise<Result<Announcement[]>> {
    return mockCall(() => listAnnouncements(classId, ME.student));
  }

  get(classId: string, id: string): Promise<Result<Announcement | null>> {
    return mockCall(() => getAnnouncement(classId, id, ME.student));
  }

  async addComment(classId: string, id: string, text: string): Promise<Result<Comment>> {
    await new Promise((resolve) => setTimeout(resolve, 280));
    const comment = addComment(classId, id, ME.student, text);
    return comment ? ok(comment) : fail(appError("not_found", "This announcement no longer exists."));
  }

  async deleteComment(classId: string, id: string, commentId: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 220));
    const outcome = deleteComment(classId, id, commentId, ME.student);
    if (outcome === "not_found") return fail(appError("not_found", "This comment no longer exists."));
    if (outcome === "forbidden") return fail(appError("unauthorized", "You can only delete your own comment.", false));
    return ok(undefined);
  }
}

class RemoteAnnouncementRepository implements AnnouncementRepository {
  listByClass = (classId: string) => remote.listAnnouncements(classId);
  get = (classId: string, id: string) => remote.getAnnouncement(classId, id);
  addComment = (classId: string, id: string, text: string) => remote.addComment(classId, id, text);
  deleteComment = (_classId: string, _id: string, commentId: string) => remote.deleteComment(commentId);
}

export const announcementRepository: AnnouncementRepository = isRemote
  ? new RemoteAnnouncementRepository()
  : new MockAnnouncementRepository();
