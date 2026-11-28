// section-header.tsx — "Title .... Action" row above a list or group of cards.
import { Pressable, StyleSheet, Text, View } from "react-native";

import { C } from "@/shared/constants/studia-colors";
import { FONT, HIT_SLOP, TYPE } from "@/shared/constants/tokens";

export function SectionHeader({
  title,
  action,
  onAction,
  compact = false,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  /** Lighter-weight heading for secondary/utility sections (e.g. Quick actions), not the page's top anchor. */
  compact?: boolean;
}) {
  return (
    <View style={s.row}>
      <Text style={[compact ? TYPE.label : TYPE.h2, s.title, compact && s.compactTitle]} numberOfLines={1}>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${title}`}
        >
          <Text style={s.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { flexShrink: 1 },
  compactTitle: { color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  action: { color: C.primary, fontSize: 13, fontFamily: FONT.semibold },
});
