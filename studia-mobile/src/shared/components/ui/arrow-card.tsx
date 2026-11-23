// arrow-card.tsx — a pressable Card that carries the same chevron affordance as the Lessons
// card (ListRow). Use it for any tappable card whose body is custom content, so "this opens
// something" looks identical everywhere. Plain ListRow stays the choice for icon/title/subtitle
// rows; ArrowCard is for richer bodies (Tasks, class stacks, grade summaries).
// Memoized: it is rendered inside AppList, so keep onPress in a useCallback.
import { memo, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Card } from "@/shared/components/ui/card";
import { Icon } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { SPACE } from "@/shared/constants/tokens";

export type ArrowCardProps = {
  children: ReactNode;
  onPress: () => void;
  /** Spoken by screen readers; the body is often graphical, so pass a sentence. */
  accessibilityLabel?: string;
  /** flat = no shadow, for a card inside another card or on a white surface. */
  flat?: boolean;
  padded?: boolean;
  disabled?: boolean;
  /** Replaces the chevron (a Badge, a score). The arrow is the default. */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const ArrowCard = memo(function ArrowCard({
  children,
  onPress,
  accessibilityLabel,
  flat,
  padded,
  disabled,
  trailing,
  style,
}: ArrowCardProps) {
  return (
    <Card
      onPress={onPress}
      disabled={disabled}
      flat={flat}
      padded={padded}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <View style={s.row}>
        <View style={s.body}>{children}</View>
        {trailing ?? <Icon name="chevron-forward" size="md" color={C.muted} />}
      </View>
    </Card>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  body: { flex: 1 },
});
