// stream-tab.tsx — Course detail "Stream" tab: pinned + recent announcements for the class.
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { Badge, Card, ListState, SectionHeader } from "@/shared/components/ui";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { timeAgo } from "@/features/student/logic/format";
import { useAnnouncements } from "@/features/student/hooks/use-announcements";

export function StreamTab({ classId }: { classId: string }) {
  const router = useRouter();
  const { data, loading, error, refetch } = useAnnouncements(classId);
  const announcements = data ?? [];

  return (
    <View style={{ gap: SPACE.md + 2 }}>
      <SectionHeader title="Announcements" />
      <ListState
        loading={loading}
        error={error}
        empty={!loading && announcements.length === 0}
        onRetry={refetch}
        emptyIcon="megaphone-outline"
        emptyTitle="No announcements yet"
        emptyMessage="Your instructor has not posted anything here yet."
      >
        <View style={{ gap: SPACE.md }}>
          {announcements.map((a) => (
            <Card
              key={a.id}
              onPress={() =>
                router.push({ pathname: "/student/announcement-detail", params: { classId, id: a.id } })
              }
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
