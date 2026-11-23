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
import { Badge } from "@/shared/components/ui/badge";
import { SPACE, TYPE } from "@/shared/constants/tokens";

export type AnnouncementCardProps = {
  title: string;
  body: string;
  /** Already-formatted ("2h ago"): formatting belongs to the feature, not to the card. */
  timeLabel: string;
  commentCount: number;
  pinned?: boolean;
  onPress: () => void;
};

export const AnnouncementCard = memo(function AnnouncementCard({
  title,
  body,
  timeLabel,
  commentCount,
  pinned = false,
  onPress,
}: AnnouncementCardProps) {
  return (
    <ArrowCard
      onPress={onPress}
      accessibilityLabel={`${pinned ? "Pinned announcement. " : ""}${title}. ${timeLabel}, ${commentCount} comment${commentCount === 1 ? "" : "s"}`}
    >
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
      <Text style={[TYPE.caption, s.meta]}>
        {timeLabel} · {commentCount} comment{commentCount === 1 ? "" : "s"}
      </Text>
    </ArrowCard>
  );
});

const s = StyleSheet.create({
  badgeRow: { flexDirection: "row", marginBottom: SPACE.xs },
  body: { marginTop: 4 },
  meta: { marginTop: SPACE.sm },
});
