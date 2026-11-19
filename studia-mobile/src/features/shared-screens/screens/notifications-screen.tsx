// notifications-screen.tsx — one implementation, role-aware via `role` (feed comes from
// notificationRepository.listByRole(role)).
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Role } from "@/core/types/role";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/shared-screens/hooks/use-notifications";
import { AppList } from "@/shared/components/ui/app-list";
import { Badge } from "@/shared/components/ui/badge";
import { ListRow } from "@/shared/components/ui/list-row";
import { ListState } from "@/shared/components/ui/list-state";
import { PageTitle } from "@/shared/components/ui/page-title";
import { Screen } from "@/shared/components/ui/screen";
import { SegmentedTabs } from "@/shared/components/ui/segmented-tabs";
import type { NotificationItem } from "@/features/shared-screens/types/shared-screens";
import { C } from "@/shared/constants/studia-colors";
import { FONT, HIT_SLOP, SPACE } from "@/shared/constants/tokens";

const FILTERS = ["All", "Unread"] as const;

export function NotificationsScreen({ role }: { role: Role }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const { data, loading, error, refetch } = useNotifications(role);
  const items = useMemo(() => data ?? [], [data]);
  const unreadCount = useMemo(() => items.filter((n) => n.unread).length, [items]);
  const shown = useMemo(
    () => (filter === "Unread" ? items.filter((n) => n.unread) : items),
    [items, filter],
  );

  const markRead = useMarkNotificationRead(role);
  const markAllRead = useMarkAllNotificationsRead(role);

  const onRowPress = useCallback((id: string) => void markRead.run(id), [markRead]);
  const onMarkAll = useCallback(() => void markAllRead.run(undefined), [markAllRead]);

  const renderRow = useCallback(
    (n: NotificationItem) => (
      <ListRow
        icon={n.icon}
        eyebrow={n.tag}
        title={n.title}
        subtitle={`${n.meta} · ${n.time}`}
        trailing={
          n.unread ? (
            <View style={s.unreadDot} accessibilityLabel="Unread" />
          ) : (
            <Badge label={n.tag} tone={n.tone} />
          )
        }
        onPress={() => onRowPress(n.id)}
      />
    ),
    [onRowPress],
  );

  return (
    <Screen role={role} scroll={false} scope={`${role}/notifications`}>
      <PageTitle
        title="Notifications"
        trailing={
          unreadCount > 0 ? (
            <Pressable
              onPress={onMarkAll}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={`Mark all ${unreadCount} notifications as read`}
            >
              <Text style={s.markAll}>Mark all read</Text>
            </Pressable>
          ) : undefined
        }
      />

      <SegmentedTabs items={FILTERS} value={filter} onChange={setFilter} />

      <View style={s.fill}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && shown.length === 0}
          onRetry={refetch}
          emptyIcon="notifications-off-outline"
          emptyTitle="You're all caught up"
          emptyMessage="New notifications will show up here."
        >
          <AppList data={shown} renderRow={renderRow} refreshing={loading} onRefresh={refetch} />
        </ListState>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  markAll: { color: C.primary, fontSize: 12.5, fontFamily: FONT.semibold },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  fill: { flex: 1, gap: SPACE.lg },
});
