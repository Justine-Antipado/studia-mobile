// announcements-repository.ts — class stream: post, pin, and moderate comments.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import { newId } from "@/features/instructor/logic/format";
import type { Announcement } from "@/features/instructor/types/instructor";

export interface InstructorAnnouncementRepository {
  listByClass(classId: string): Promise<Result<Announcement[]>>;
  get(classId: string, id: string): Promise<Result<Announcement | null>>;
  create(classId: string, input: { title: string; body: string; pinned: boolean }): Promise<Result<Announcement>>;
  deleteComment(classId: string, id: string, commentId: string): Promise<Result<void>>;
  remove(classId: string, id: string): Promise<Result<void>>;
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

let ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ian1",
    classId: "it321",
    title: "Midterm exam schedule",
    body: "Our midterm exam is on Nov 10-14, 2026. Coverage: Lessons 1-5. Bring your own calculator.",
    postedAt: ago(60 * 6),
    pinned: true,
    comments: [
      { id: "ic1", author: "Ana Villanueva", authorIsMe: false, text: "Is this open book, Prof?", postedAt: ago(60 * 5) },
      { id: "ic2", author: "You", authorIsMe: true, text: "Closed book, but you may bring one index card of notes.", postedAt: ago(60 * 4) },
    ],
  },
  {
    id: "ian2",
    classId: "it321",
    title: "Lesson 3 slides updated",
    body: "Fixed a typo on slide 14 (symmetric vs asymmetric encryption). Please re-download before reviewing.",
    postedAt: ago(60 * 30),
    pinned: false,
    comments: [],
  },
  {
    id: "ian3",
    classId: "it314",
    title: "Lesson 6: REST APIs is up",
    body: "Covers resource naming, status codes and the request/response cycle. Quiz 3 will draw from this.",
    postedAt: ago(90),
    pinned: false,
    comments: [{ id: "ic3", author: "Mark Bautista", authorIsMe: false, text: "Will there be a hands-on lab?", postedAt: ago(60) }],
  },
];

class MockInstructorAnnouncementRepository implements InstructorAnnouncementRepository {
  listByClass(classId: string): Promise<Result<Announcement[]>> {
    return mockCall(() =>
      ANNOUNCEMENTS.filter((a) => a.classId === classId).sort((a, b) => b.postedAt.localeCompare(a.postedAt)),
    );
  }

  get(classId: string, id: string): Promise<Result<Announcement | null>> {
    return mockCall(() => ANNOUNCEMENTS.find((a) => a.classId === classId && a.id === id) ?? null);
  }

  async create(
    classId: string,
    input: { title: string; body: string; pinned: boolean },
  ): Promise<Result<Announcement>> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const announcement: Announcement = {
      id: newId("an"),
      classId,
      title: input.title.trim(),
      body: input.body.trim(),
      postedAt: new Date().toISOString(),
      pinned: input.pinned,
      comments: [],
    };
    ANNOUNCEMENTS = [announcement, ...ANNOUNCEMENTS];
    return ok(announcement);
  }

  async deleteComment(classId: string, id: string, commentId: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const target = ANNOUNCEMENTS.find((a) => a.classId === classId && a.id === id);
    if (!target) return fail(appError("not_found", "This announcement no longer exists."));
    ANNOUNCEMENTS = ANNOUNCEMENTS.map((a) =>
      a.id === id ? { ...a, comments: a.comments.filter((c) => c.id !== commentId) } : a,
    );
    return ok(undefined);
  }

  async remove(classId: string, id: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!ANNOUNCEMENTS.some((a) => a.classId === classId && a.id === id)) {
      return fail(appError("not_found", "This announcement no longer exists."));
    }
    ANNOUNCEMENTS = ANNOUNCEMENTS.filter((a) => a.id !== id);
    return ok(undefined);
  }
}

export const instructorAnnouncementRepository: InstructorAnnouncementRepository =
  new MockInstructorAnnouncementRepository();
