// quick-action.tsx — icon + label shortcut in the Home "Quick actions" row.
import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { IconTile, type IconName } from "@/shared/components/ui/icon";
import { C, TONES, type Tone } from "@/shared/constants/studia-colors";
import { FONT, SPACE } from "@/shared/constants/tokens";
import { useResponsive } from "@/shared/hooks/use-responsive";

export const QuickAction = memo(function QuickAction({
  icon,
  label,
  tone = "primary",
  onPress,
}: {
  icon: IconName;
  label: string;
  tone?: Tone;
  onPress?: () => void;
}) {
  const { actionIconSize } = useResponsive();
  const c = TONES[tone];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.wrap,
        { width: actionIconSize + 12 },
        pressed && { transform: [{ scale: 0.95 }] },
      ]}
    >
      <IconTile name={icon} size={actionIconSize} bg={c.bg} color={c.fg} />
      <Text style={s.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
});

const s = StyleSheet.create({
  wrap: { alignItems: "center", gap: SPACE.xs + 2 },
  label: {
    color: C.muted,
    fontSize: 11.5,
    lineHeight: 15,
    textAlign: "center",
    fontFamily: FONT.regular,
  },
});
