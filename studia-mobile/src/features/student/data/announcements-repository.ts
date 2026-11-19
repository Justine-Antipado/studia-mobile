// announcements-repository.ts — class stream + comments. Mock now, same shape the real
// API will return per docs/api-contract.md once the backend exists.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { Announcement, Comment } from "@/features/student/types/student";

export interface AnnouncementRepository {
  listByClass(classId: string): Promise<Result<Announcement[]>>;
  get(classId: string, id: string): Promise<Result<Announcement | null>>;
  addComment(classId: string, id: string, text: string): Promise<Result<Comment>>;
  deleteComment(classId: string, id: string, commentId: string): Promise<Result<void>>;
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

let ANNOUNCEMENTS: Announcement[] = [
  {
    id: "an1",
    classId: "it321",
    title: "Midterm exam schedule",
    body: "Our midterm exam is on Nov 10-14, 2026. Coverage: Lessons 1-5 (CIA triad, firewalls, IDS, access control, cryptography basics). Bring your own calculator.",
    postedAt: ago(60 * 6),
    pinned: true,
    comments: [
      { id: "c1", author: "Ana Villanueva", authorIsMe: false, text: "Is this open book, Prof?", postedAt: ago(60 * 5) },
      { id: "c2", author: "Prof. Maria Santos", authorIsMe: false, text: "Closed book, but you may bring one index card of notes.", postedAt: ago(60 * 4) },
    ],
  },
  {
    id: "an2",
    classId: "it321",
    title: "Lesson 3 slides updated",
    body: "I fixed a typo on slide 14 (symmetric vs asymmetric encryption). Please re-download before reviewing.",
    postedAt: ago(60 * 30),
    pinned: false,
    comments: [],
  },
  {
    id: "an3",
    classId: "it314",
    title: "Lesson 6: REST APIs is up",
    body: "Covers resource naming, status codes and the request/response cycle. Quiz 3 will draw from this.",
    postedAt: ago(90),
    pinned: false,
    comments: [
      { id: "c3", author: "Mark Bautista", authorIsMe: false, text: "Will there be a hands-on lab?", postedAt: ago(60) },
    ],
  },
  {
    id: "an4",
    classId: "it318",
    title: "Welcome to Mobile Application Development",
    body: "We will build an Expo app together this term. Install Expo Go on your phone before our next meeting.",
    postedAt: ago(60 * 48),
    pinned: true,
    comments: [],
  },
];

class MockAnnouncementRepository implements AnnouncementRepository {
  listByClass(classId: string): Promise<Result<Announcement[]>> {
    return mockCall(() =>
      ANNOUNCEMENTS.filter((a) => a.classId === classId).sort((a, b) => b.postedAt.localeCompare(a.postedAt)),
    );
  }

  get(classId: string, id: string): Promise<Result<Announcement | null>> {
    return mockCall(() => ANNOUNCEMENTS.find((a) => a.classId === classId && a.id === id) ?? null);
  }

  async addComment(classId: string, id: string, text: string): Promise<Result<Comment>> {
    await new Promise((resolve) => setTimeout(resolve, 280));
    const target = ANNOUNCEMENTS.find((a) => a.classId === classId && a.id === id);
    if (!target) return fail(appError("not_found", "This announcement no longer exists."));
    const comment: Comment = { id: newId("c"), author: "You", authorIsMe: true, text, postedAt: new Date().toISOString() };
    ANNOUNCEMENTS = ANNOUNCEMENTS.map((a) => (a.id === id ? { ...a, comments: [...a.comments, comment] } : a));
    return ok(comment);
  }

  async deleteComment(classId: string, id: string, commentId: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 220));
    const target = ANNOUNCEMENTS.find((a) => a.classId === classId && a.id === id);
    const comment = target?.comments.find((c) => c.id === commentId);
    if (!target || !comment) return fail(appError("not_found", "This comment no longer exists."));
    if (!comment.authorIsMe) return fail(appError("unauthorized", "You can only delete your own comment.", false));
    ANNOUNCEMENTS = ANNOUNCEMENTS.map((a) =>
      a.id === id ? { ...a, comments: a.comments.filter((c) => c.id !== commentId) } : a,
    );
    return ok(undefined);
  }
}

export const announcementRepository: AnnouncementRepository = new MockAnnouncementRepository();
