// stream-tab.tsx — Class detail "Stream" tab: pinned + recent announcements, post new ones.
// Container: it fetches and groups; AnnouncementCard is the presentational half.
// The Filters + Post row is the FIRST thing in the tab, above Pinned, so it stays reachable no
// matter how many announcements pile up underneath it.
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import {
  ActionButton,
  AnnouncementCard,
  Badge,
  FilterPillSheet,
  ListState,
  SectionHeader,
  type FilterGroup,
  type FilterValues,
} from "@/shared/components/ui";
import { Icon } from "@/shared/components/ui/icon";
import { TONES } from "@/shared/constants/studia-colors";
import { RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";
import { splitPinned } from "@/shared/utils/pinned";
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { timeAgo } from "@/features/instructor/logic/format";
import { useClassAnnouncements } from "@/features/instructor/hooks/use-announcements";

const SHOW_GROUPS: FilterGroup[] = [
  {
    key: "show",
    title: "Show",
    options: [
      { value: "all", label: "All announcements" },
      { value: "pinned", label: "Pinned only" },
    ],
  },
];
const DEFAULT_FILTERS = { show: "all" };

export function StreamTab({ classId }: { classId: string }) {
  const router = useSafeRouter();
  const { data, loading, error, refetch } = useClassAnnouncements(classId);
  const { pinned, rest } = splitPinned(data ?? []);
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const pinnedOnly = filters.show === "pinned";
  const nothingToShow = pinnedOnly ? pinned.length === 0 : pinned.length === 0 && rest.length === 0;

  const open = useCallback(
    (id: string) => router.push({ pathname: "/instructor/announcement-detail", params: { classId, id } }),
    [router, classId],
  );

  const card = (a: (typeof rest)[number]) => (
    <AnnouncementCard
      key={a.id}
      title={a.title}
      body={a.body}
      timeLabel={timeAgo(a.postedAt)}
      commentCount={a.comments.length}
      pinned={a.pinned}
      authorId={a.authorId}
      authorName={a.authorName}
      onPress={() => open(a.id)}
    />
  );

  return (
    <View style={s.root}>
      <View style={s.head}>
        <SectionHeader title="Announcements" />
        <View style={s.headActions}>
          <FilterPillSheet groups={SHOW_GROUPS} value={filters} defaults={DEFAULT_FILTERS} onApply={setFilters} />
          <ActionButton
            label="Post"
            icon="add"
            variant="secondary"
            size="sm"
            onPress={() => router.push({ pathname: "/instructor/post-announcement", params: { classId } })}
          />
        </View>
      </View>

      <ListState
        loading={loading}
        error={error}
        empty={!loading && nothingToShow}
        onRetry={refetch}
        emptyIcon="megaphone-outline"
        emptyTitle={pinnedOnly ? "No pinned announcements" : "No announcements yet"}
        emptyMessage={pinnedOnly ? "Pin an announcement to see it here." : "Post one to keep your class updated."}
      >
        <View style={s.root}>
          {pinned.length > 0 ? (
            <View style={s.pinnedBox}>
              <View style={s.pinnedHead}>
                <View style={s.pinnedTitle}>
                  <Icon name="pin" size="sm" color={TONES.gold.fg} />
                  <Text style={TYPE.h3} numberOfLines={1}>
                    Pinned Announcements
                  </Text>
                </View>
                <Badge label="Pinned" tone="gold" />
              </View>
              <View style={s.list}>{pinned.map(card)}</View>
            </View>
          ) : null}

          {pinnedOnly ? null : (
            <>
              <SectionHeader title="Recent Announcements" />
              <View style={s.list}>{rest.map(card)}</View>
            </>
          )}
        </View>
      </ListState>
    </View>
  );
}

const s = {
  root: { gap: SPACE.md + 2 },
  list: { gap: SPACE.md },
  head: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    rowGap: SPACE.sm,
    columnGap: SPACE.sm,
  },
  headActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: SPACE.md },
  pinnedBox: {
    gap: SPACE.md,
    backgroundColor: TONES.gold.bg,
    borderWidth: 1,
    borderColor: TONES.gold.border,
    borderRadius: RADIUS.xl,
    padding: SPACE.md + 2,
  },
  pinnedHead: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: SPACE.sm },
  pinnedTitle: { flexDirection: "row", alignItems: "center", gap: SPACE.xs + 2, flexShrink: 1 },
} as const;
