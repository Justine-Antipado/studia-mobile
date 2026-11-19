// notifications-repository.ts — one feed per role. Mock now, same shape the real API will
// return per docs/api-contract.md once the backend exists.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { Role } from "@/core/types/role";
import type { NotificationItem } from "@/features/shared-screens/types/shared-screens";

export interface NotificationRepository {
  listByRole(role: Role): Promise<Result<NotificationItem[]>>;
  markRead(role: Role, id: string): Promise<Result<void>>;
  markAllRead(role: Role): Promise<Result<void>>;
}

const FEEDS: Record<Role, NotificationItem[]> = {
  student: [
    {
      id: "1",
      icon: "megaphone-outline",
      title: "Midterm exam schedule",
      meta: "IT 321 · Nov 10–14, 2026",
      time: "2h",
      unread: true,
      tone: "primary",
      tag: "Notice",
    },
    {
      id: "2",
      icon: "document-text-outline",
      title: "Quiz 2 due today",
      meta: "IT 321 · 5:00 PM",
      time: "5h",
      unread: true,
      tone: "orange",
      tag: "Quiz",
    },
    {
      id: "3",
      icon: "bar-chart-outline",
      title: "Quiz 1 graded",
      meta: "You scored 18/20",
      time: "1d",
      unread: false,
      tone: "green",
      tag: "Grade",
    },
    {
      id: "4",
      icon: "book-outline",
      title: "New lesson posted",
      meta: "Lesson 3: Network Security Basics",
      time: "2d",
      unread: false,
      tone: "blue",
      tag: "Lesson",
    },
  ],
  instructor: [
    {
      id: "1",
      icon: "document-text-outline",
      title: "12 submissions need grading",
      meta: "Quiz 2 · IT 321",
      time: "1h",
      unread: true,
      tone: "orange",
      tag: "Grade",
    },
    {
      id: "2",
      icon: "person-add-outline",
      title: "3 students joined your class",
      meta: "IT 321 · Section A",
      time: "4h",
      unread: true,
      tone: "blue",
      tag: "Class",
    },
    {
      id: "3",
      icon: "sparkles-outline",
      title: "AI quiz is ready to review",
      meta: "Generated from Lesson 3",
      time: "1d",
      unread: false,
      tone: "primary",
      tag: "AI",
    },
    {
      id: "4",
      icon: "calendar-outline",
      title: "Midterm exam reminder",
      meta: "Nov 10–14, 2026",
      time: "3d",
      unread: false,
      tone: "green",
      tag: "Reminder",
    },
  ],
};

class MockNotificationRepository implements NotificationRepository {
  listByRole(role: Role): Promise<Result<NotificationItem[]>> {
    return mockCall(() => FEEDS[role]);
  }

  markRead(role: Role, id: string): Promise<Result<void>> {
    const feed = FEEDS[role];
    if (!feed.some((n) => n.id === id)) {
      return Promise.resolve(fail(appError("not_found", "This notification no longer exists.")));
    }
    FEEDS[role] = feed.map((n) => (n.id === id ? { ...n, unread: false } : n));
    return mockCall(() => undefined);
  }

  markAllRead(role: Role): Promise<Result<void>> {
    FEEDS[role] = FEEDS[role].map((n) => ({ ...n, unread: false }));
    return mockCall(() => undefined);
  }
}

export const notificationRepository: NotificationRepository = new MockNotificationRepository();
