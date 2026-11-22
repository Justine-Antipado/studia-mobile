// mock-notifications.ts — notifications are DERIVED from events, not hand-typed feeds. Every mock
// write that the other side should hear about (post, comment, assignment, turn-in, grade, quiz,
// material, join) calls `notify`, exactly as a database trigger / the API would on the real backend.
//   - the actor is never notified about their own action
//   - readAt is set by the owner only (RLS: owner can update read state)
import { dbId, mockDb, type DbNotification, type NotificationTag } from "@/core/data/mock/mock-db";
import { mockNowIso } from "@/core/data/mock/mock-clock";

export type NotifyInput = {
  tag: NotificationTag;
  title: string;
  meta: string;
  body?: string;
};

/** Notify every user in `userIds` except `actorId`. */
export function notify(userIds: readonly string[], input: NotifyInput, actorId?: string) {
  const now = mockNowIso();
  const rows: DbNotification[] = [...new Set(userIds)]
    .filter((id) => id !== actorId)
    .map((userId) => ({
      id: dbId("nt"),
      userId,
      tag: input.tag,
      title: input.title,
      meta: input.meta,
      body: input.body ?? null,
      createdAt: now,
      readAt: null,
    }));
  if (rows.length === 0) return;
  mockDb.notifications = [...rows, ...mockDb.notifications];
  mockDb.emit();
}

/** Students enrolled in a class, as user ids. */
export const studentIdsOf = (classId: string) => mockDb.studentsOf(classId).map((u) => u.id);

export const classCodeOf = (classId: string) => mockDb.cls(classId)?.code ?? "Class";

export const ownerOf = (classId: string) => mockDb.cls(classId)?.ownerId;

export const nameOf = (userId: string) => mockDb.user(userId)?.name ?? "Someone";

export function listFor(userId: string): DbNotification[] {
  return mockDb.notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markRead(userId: string, id: string): boolean {
  const n = mockDb.notifications.find((x) => x.id === id && x.userId === userId);
  if (!n) return false;
  if (!n.readAt) {
    mockDb.notifications = mockDb.notifications.map((x) => (x.id === id ? { ...x, readAt: mockNowIso() } : x));
    mockDb.emit();
  }
  return true;
}

export function markAllRead(userId: string) {
  const now = mockNowIso();
  mockDb.notifications = mockDb.notifications.map((x) => (x.userId === userId && !x.readAt ? { ...x, readAt: now } : x));
  mockDb.emit();
}
