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
import { BottomSheet } from "@/shared/components/ui/bottom-sheet";
import { AppList } from "@/shared/components/ui/app-list";
import { Badge } from "@/shared/components/ui/badge";
import { FilterPillSheet, type FilterGroup } from "@/shared/components/ui/filter-pill-sheet";
import { ListRow } from "@/shared/components/ui/list-row";
import { ListState } from "@/shared/components/ui/list-state";
import { PageTitle } from "@/shared/components/ui/page-title";
import { Screen } from "@/shared/components/ui/screen";
import type { NotificationItem } from "@/features/shared-screens/types/shared-screens";
import { C } from "@/shared/constants/studia-colors";
import { FONT, HIT_SLOP, SPACE, TYPE } from "@/shared/constants/tokens";

/** "Read" joins All and Unread; the three live in the Filters sheet. */
type Filter = "all" | "unread" | "read";
const DEFAULT_FILTERS = { show: "all" };
/** Stable empty list: the loading / error / empty states are drawn by ListState below the rows. */
const NO_ROWS: NotificationItem[] = [];

export function NotificationsScreen({ role }: { role: Role }) {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, loading, error, refetch } = useNotifications(role);
  const items = useMemo(() => data ?? [], [data]);
  const unreadCount = useMemo(() => items.filter((n) => n.unread).length, [items]);
  const shown = useMemo(() => {
    if (filter === "unread") return items.filter((n) => n.unread);
    if (filter === "read") return items.filter((n) => !n.unread);
    return items;
  }, [items, filter]);

  // Counts live on the options so the dropdown says how much each filter holds.
  const filterGroups = useMemo<FilterGroup[]>(
    () => [
      {
        key: "show",
        title: "Show",
        options: [
          { value: "all", label: "All alerts", meta: String(items.length) },
          { value: "unread", label: "Unread", meta: String(unreadCount) },
          { value: "read", label: "Read", meta: String(items.length - unreadCount) },
        ],
      },
    ],
    [items.length, unreadCount],
  );

  const emptyCopy: Record<Filter, { title: string; message: string }> = {
    all: { title: "You're all caught up", message: "New notifications will show up here." },
    unread: { title: "Nothing unread", message: "Every alert has been read." },
    read: { title: "Nothing read yet", message: "Alerts you open will appear here." },
  };

  const markRead = useMarkNotificationRead(role);
  const markAllRead = useMarkAllNotificationsRead(role);

  const [openId, setOpenId] = useState<string | null>(null);
  const opened = useMemo(() => items.find((n) => n.id === openId) ?? null, [items, openId]);
  // Opening the detail is what marks it read (not the list tap itself).
  const onRowPress = useCallback(
    (n: NotificationItem) => {
      setOpenId(n.id);
      if (n.unread) void markRead.run(n.id);
    },
    [markRead],
  );
  const onMarkAll = useCallback(() => void markAllRead.run(undefined), [markAllRead]);

  const renderRow = useCallback(
    (n: NotificationItem) => (
      <ListRow
        icon={n.icon}
        eyebrow={n.tag}
        title={n.title}
        subtitle={`${n.meta} · ${n.time}`}
        trailing={n.unread ? <View style={s.unreadDot} accessibilityLabel="Unread" /> : undefined}
        onPress={() => onRowPress(n)}
      />
    ),
    [onRowPress],
  );

  // The page chrome rides inside the list so the list itself starts at the top of the content
  // area: pull-to-refresh then comes from directly under the header, exactly like Home.
  const chrome = (
    <View style={s.chrome}>
      <PageTitle
        title="Alerts"
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

      <FilterPillSheet
        groups={filterGroups}
        value={{ show: filter }}
        defaults={DEFAULT_FILTERS}
        onApply={(next) => setFilter(next.show as Filter)}
      />
    </View>
  );

  return (
    <Screen
      role={role}
      scroll={false}
      tabScreen
      scope={`${role}/notifications`}
      contentStyle={s.flush}
      refreshing={loading}
      onRefresh={refetch}
    >
      <AppList
        data={loading || error ? NO_ROWS : shown}
        renderRow={renderRow}
        header={chrome}
        footer={
          <ListState
            loading={loading}
            error={error}
            empty={!loading && shown.length === 0}
            onRetry={refetch}
            emptyIcon="notifications-off-outline"
            emptyTitle={emptyCopy[filter].title}
            emptyMessage={emptyCopy[filter].message}
          >
            {null}
          </ListState>
        }
      />

      <BottomSheet visible={!!opened} title={opened?.tag ?? "Notification"} onClose={() => setOpenId(null)}>
        {opened ? (
          <View style={s.detail}>
            <Badge label={opened.tag} tone={opened.tone} />
            <Text style={TYPE.h2}>{opened.title}</Text>
            <Text style={TYPE.caption}>{`${opened.meta} · ${opened.time} ago`}</Text>
            <Text style={TYPE.body}>{opened.body ?? opened.meta}</Text>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  markAll: { color: C.primary, fontSize: 12.5, fontFamily: FONT.semibold },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
  // Screen's fixed padding is moved onto the list header so the scroll area (and the refresh
  // spinner) starts flush under the header; the spacing on screen is unchanged.
  flush: { paddingTop: 0 },
  chrome: { paddingTop: SPACE.md + 2, paddingBottom: SPACE.md + 2, gap: SPACE.md + 2 },
  detail: { gap: SPACE.sm, alignItems: "flex-start" },
});
