// stream-tab.tsx — Class detail "Stream" tab: pinned + recent announcements, post new ones.
// Container: it fetches and groups; AnnouncementCard is the presentational half.
import { useCallback } from "react";
import { View } from "react-native";

import { ActionButton, AnnouncementCard, ListState, SectionHeader } from "@/shared/components/ui";
import { SPACE } from "@/shared/constants/tokens";
import { splitPinned } from "@/shared/utils/pinned";
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { timeAgo } from "@/features/instructor/logic/format";
import { useClassAnnouncements } from "@/features/instructor/hooks/use-announcements";

export function StreamTab({ classId }: { classId: string }) {
  const router = useSafeRouter();
  const { data, loading, error, refetch } = useClassAnnouncements(classId);
  const { pinned, rest } = splitPinned(data ?? []);

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
      onPress={() => open(a.id)}
    />
  );

  return (
    <View style={s.root}>
      {/* Pinned sits in its own section at the top, so later posts can never cover it (B2). */}
      {pinned.length > 0 ? (
        <>
          <SectionHeader title="Pinned" />
          <View style={s.list}>{pinned.map(card)}</View>
        </>
      ) : null}

      <View style={s.head}>
        <SectionHeader title="Announcements" />
        <ActionButton
          label="Post"
          icon="add"
          variant="secondary"
          onPress={() => router.push({ pathname: "/instructor/post-announcement", params: { classId } })}
        />
      </View>
      <ListState
        loading={loading}
        error={error}
        empty={!loading && pinned.length === 0 && rest.length === 0}
        onRetry={refetch}
        emptyIcon="megaphone-outline"
        emptyTitle="No announcements yet"
        emptyMessage="Post one to keep your class updated."
      >
        <View style={s.list}>{rest.map(card)}</View>
      </ListState>
    </View>
  );
}

const s = {
  root: { gap: SPACE.md + 2 },
  list: { gap: SPACE.md },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
} as const;
