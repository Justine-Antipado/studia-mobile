// announcement-card.tsx — one announcement as a tappable card. Pure UI: the student and the
// instructor Stream tabs both render it, so a change to the layout cannot drift between roles.
//
// B2: the "Pinned" badge sits on its own row ABOVE the title instead of sharing the row with it.
// Before, a long title took the whole width and squeezed the badge out of view, and a pinned post
// could also be buried under later posts — the query now orders pinned first and the Stream puts
// them in their own section.
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ArrowCard } from "@/shared/components/ui/arrow-card";
import { Avatar } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Icon } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";

export type AnnouncementCardProps = {
  title: string;
  body: string;
  /** Already-formatted ("2h ago"): formatting belongs to the feature, not to the card. */
  timeLabel: string;
  commentCount: number;
  pinned?: boolean;
  authorId: string | null;
  authorName: string;
  onPress: () => void;
};

export const AnnouncementCard = memo(function AnnouncementCard({
  title,
  body,
  timeLabel,
  commentCount,
  pinned = false,
  authorId,
  authorName,
  onPress,
}: AnnouncementCardProps) {
  return (
    <ArrowCard
      onPress={onPress}
      accessibilityLabel={`${pinned ? "Pinned announcement. " : ""}${authorName}, Instructor. ${title}. ${timeLabel}, ${commentCount} comment${commentCount === 1 ? "" : "s"}`}
    >
      <View style={s.authorRow}>
        <Avatar name={authorName} userId={authorId} size={28} />
        <Text style={[TYPE.bodyStrong, s.authorName]} numberOfLines={1}>
          {authorName}
        </Text>
        <Badge label="Instructor" tone="primary" />
      </View>
      {pinned ? (
        <View style={s.badgeRow}>
          <Badge label="Pinned" tone="gold" />
        </View>
      ) : null}
      <Text style={TYPE.h3} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[TYPE.muted, s.body]} numberOfLines={2}>
        {body}
      </Text>
      <View style={s.meta}>
        <Text style={TYPE.caption}>{timeLabel}</Text>
        <View style={s.commentMeta}>
          <Icon name="chatbubble-outline" size="xs" color={C.muted} />
          <Text style={TYPE.caption}>{commentCount}</Text>
        </View>
      </View>
    </ArrowCard>
  );
});

const s = StyleSheet.create({
  authorRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.xs },
  authorName: { flex: 1 },
  badgeRow: { flexDirection: "row", marginBottom: SPACE.xs },
  body: { marginTop: 4 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACE.sm,
  },
  commentMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
});
