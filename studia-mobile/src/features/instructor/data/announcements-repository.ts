// announcements-repository.ts — instructor view over the shared mock DB: post, pin, comment and
// moderate comments. Posts show up in the students' Stream immediately.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { isRemote } from "@/core/config/data-source";
import * as remote from "@/core/data/supabase/announcements-remote";
import { ME } from "@/core/data/mock/mock-db";
import {
  addComment,
  createAnnouncement,
  deleteComment,
  getAnnouncement,
  listAnnouncements,
  removeAnnouncement,
} from "@/core/data/mock/mock-announcements";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { Announcement, Comment } from "@/features/instructor/types/instructor";

export interface InstructorAnnouncementRepository {
  listByClass(classId: string): Promise<Result<Announcement[]>>;
  get(classId: string, id: string): Promise<Result<Announcement | null>>;
  create(classId: string, input: { title: string; body: string; pinned: boolean }): Promise<Result<Announcement>>;
  addComment(classId: string, id: string, text: string): Promise<Result<Comment>>;
  deleteComment(classId: string, id: string, commentId: string): Promise<Result<void>>;
  remove(classId: string, id: string): Promise<Result<void>>;
}

class MockInstructorAnnouncementRepository implements InstructorAnnouncementRepository {
  listByClass(classId: string): Promise<Result<Announcement[]>> {
    return mockCall(() => listAnnouncements(classId, ME.instructor));
  }

  get(classId: string, id: string): Promise<Result<Announcement | null>> {
    return mockCall(() => getAnnouncement(classId, id, ME.instructor));
  }

  async create(
    classId: string,
    input: { title: string; body: string; pinned: boolean },
  ): Promise<Result<Announcement>> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const created = createAnnouncement(classId, ME.instructor, input);
    return created ? ok(created) : fail(appError("not_found", "This class no longer exists."));
  }

  async addComment(classId: string, id: string, text: string): Promise<Result<Comment>> {
    await new Promise((resolve) => setTimeout(resolve, 280));
    const comment = addComment(classId, id, ME.instructor, text);
    return comment ? ok(comment) : fail(appError("not_found", "This announcement no longer exists."));
  }

  async deleteComment(classId: string, id: string, commentId: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const outcome = deleteComment(classId, id, commentId, ME.instructor);
    return outcome === "ok" ? ok(undefined) : fail(appError("not_found", "This comment no longer exists."));
  }

  async remove(classId: string, id: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return removeAnnouncement(classId, id, ME.instructor)
      ? ok(undefined)
      : fail(appError("not_found", "This announcement no longer exists."));
  }
}

class RemoteInstructorAnnouncementRepository implements InstructorAnnouncementRepository {
  listByClass = (classId: string) => remote.listAnnouncements(classId);
  get = (classId: string, id: string) => remote.getAnnouncement(classId, id);
  create = (classId: string, input: { title: string; body: string; pinned: boolean }) => remote.createAnnouncement(classId, input);
  addComment = (classId: string, id: string, text: string) => remote.addComment(classId, id, text);
  deleteComment = (_classId: string, _id: string, commentId: string) => remote.deleteComment(commentId);
  remove = (classId: string, id: string) => remote.removeAnnouncement(classId, id);
}

export const instructorAnnouncementRepository: InstructorAnnouncementRepository = isRemote
  ? new RemoteInstructorAnnouncementRepository()
  : new MockInstructorAnnouncementRepository();
