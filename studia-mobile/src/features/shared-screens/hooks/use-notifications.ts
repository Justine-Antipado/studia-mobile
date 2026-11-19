// use-notifications.ts — read/mark-read is optimistic (instant dot clear, rolled back
// automatically if the repository call fails).
import { cacheKey } from "@/core/data/cache/cache-keys";
import { queryCache, TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import type { Role } from "@/core/types/role";
import { notificationRepository } from "@/features/shared-screens/data/notifications-repository";
import type { NotificationItem } from "@/features/shared-screens/types/shared-screens";

const feedKey = (role: Role) => cacheKey("notifications", role);

export function useNotifications(role: Role) {
  return useQuery(feedKey(role), () => notificationRepository.listByRole(role), { ttlMs: TTL.live });
}

export function useMarkNotificationRead(role: Role) {
  const key = feedKey(role);
  return useMutation((id: string) => notificationRepository.markRead(role, id), {
    optimistic: {
      key,
      apply: (id: string) => {
        const entry = queryCache.getEntry<NotificationItem[]>(key);
        if (!entry) return;
        queryCache.set(
          key,
          entry.data.map((n) => (n.id === id ? { ...n, unread: false } : n)),
          TTL.live,
        );
      },
    },
    invalidate: () => key,
  });
}

export function useMarkAllNotificationsRead(role: Role) {
  const key = feedKey(role);
  return useMutation(() => notificationRepository.markAllRead(role), {
    optimistic: {
      key,
      apply: () => {
        const entry = queryCache.getEntry<NotificationItem[]>(key);
        if (!entry) return;
        queryCache.set(key, entry.data.map((n) => ({ ...n, unread: false })), TTL.live);
      },
    },
    invalidate: () => key,
  });
}
