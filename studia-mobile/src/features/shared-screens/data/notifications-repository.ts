// notifications-repository.ts — one feed per role, as a view over the shared mock DB. Rows are
// created by events (see core/data/mock/mock-notifications.ts), so an instructor posting an
// announcement really does produce a notice for each enrolled student. Same shape the real API will
// return per docs/api-contract.md.
import { queryCache } from "@/core/data/cache/query-cache";
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail } from "@/core/data/errors/app-error";
import { ME, mockDb, type DbNotification, type NotificationTag } from "@/core/data/mock/mock-db";
import { mockCall } from "@/core/data/mock/mock-latency";
import { listFor, markAllRead, markRead } from "@/core/data/mock/mock-notifications";
import type { Role } from "@/core/types/role";
import type { IconName } from "@/shared/components/ui/icon";
import type { Tone } from "@/shared/constants/studia-colors";
import type { NotificationItem } from "@/features/shared-screens/types/shared-screens";

export interface NotificationRepository {
  listByRole(role: Role): Promise<Result<NotificationItem[]>>;
  markRead(role: Role, id: string): Promise<Result<void>>;
  markAllRead(role: Role): Promise<Result<void>>;
}

const LOOK: Record<NotificationTag, { icon: IconName; tone: Tone }> = {
  Notice: { icon: "megaphone-outline", tone: "primary" },
  Quiz: { icon: "document-text-outline", tone: "orange" },
  Grade: { icon: "bar-chart-outline", tone: "green" },
  Lesson: { icon: "book-outline", tone: "blue" },
  Class: { icon: "person-add-outline", tone: "blue" },
  AI: { icon: "sparkles-outline", tone: "primary" },
  Reminder: { icon: "calendar-outline", tone: "gold" },
};

/** "now" / "5m" / "2h" / "3d" */
function shortAge(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}d`;
}

const toItem = (n: DbNotification): NotificationItem => ({
  id: n.id,
  icon: LOOK[n.tag].icon,
  tone: LOOK[n.tag].tone,
  tag: n.tag,
  title: n.title,
  meta: n.meta,
  body: n.body ?? undefined,
  time: shortAge(n.createdAt),
  unread: n.readAt === null,
});

class MockNotificationRepository implements NotificationRepository {
  listByRole(role: Role): Promise<Result<NotificationItem[]>> {
    return mockCall(() => listFor(ME[role]).map(toItem));
  }

  markRead(role: Role, id: string): Promise<Result<void>> {
    if (!markRead(ME[role], id)) {
      return Promise.resolve(fail(appError("not_found", "This notification no longer exists.")));
    }
    return mockCall(() => undefined);
  }

  markAllRead(role: Role): Promise<Result<void>> {
    markAllRead(ME[role]);
    return mockCall(() => undefined);
  }
}

// A new notification (another user acted) must reach the open Alerts tab and the tab badge without
// waiting for the cache to expire: refresh the feeds whenever the number of rows grows.
let seenCount = mockDb.notifications.length;
mockDb.subscribe(() => {
  if (mockDb.notifications.length !== seenCount) {
    seenCount = mockDb.notifications.length;
    queryCache.invalidate("notifications");
  }
});

export const notificationRepository: NotificationRepository = new MockNotificationRepository();
