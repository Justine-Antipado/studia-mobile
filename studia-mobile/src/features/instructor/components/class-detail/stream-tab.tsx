// stream-tab.tsx — Class detail "Stream" tab: pinned + recent announcements, post new ones.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { Text, View } from "react-native";

import { ActionButton, Badge, Card, ListState, SectionHeader } from "@/shared/components/ui";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { timeAgo } from "@/features/instructor/logic/format";
import { useClassAnnouncements } from "@/features/instructor/hooks/use-announcements";

export function StreamTab({ classId }: { classId: string }) {
  const router = useSafeRouter();
  const { data, loading, error, refetch } = useClassAnnouncements(classId);
  const announcements = data ?? [];

  return (
    <View style={{ gap: SPACE.md + 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
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
        empty={!loading && announcements.length === 0}
        onRetry={refetch}
        emptyIcon="megaphone-outline"
        emptyTitle="No announcements yet"
        emptyMessage="Post one to keep your class updated."
      >
        <View style={{ gap: SPACE.md }}>
          {announcements.map((a) => (
            <Card
              key={a.id}
              onPress={() => router.push({ pathname: "/instructor/announcement-detail", params: { classId, id: a.id } })}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: SPACE.sm }}>
                <Text style={TYPE.h3} numberOfLines={2}>
                  {a.title}
                </Text>
                {a.pinned ? <Badge label="Pinned" tone="gold" /> : null}
              </View>
              <Text style={[TYPE.muted, { marginTop: 4 }]} numberOfLines={2}>
                {a.body}
              </Text>
              <Text style={[TYPE.caption, { marginTop: SPACE.sm }]}>
                {timeAgo(a.postedAt)} · {a.comments.length} comment{a.comments.length === 1 ? "" : "s"}
              </Text>
            </Card>
          ))}
        </View>
      </ListState>
    </View>
  );
}
