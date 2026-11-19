// chip.tsx — one selectable filter chip (Bloom level, difficulty, task filter, segment).
import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { Icon, type IconName } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { FONT, HIT_SLOP, RADIUS, SPACE } from "@/shared/constants/tokens";

export const Chip = memo(function Chip({
  label,
  selected = false,
  icon,
  onPress,
  disabled,
  role = "button",
}: {
  label: string;
  selected?: boolean;
  icon?: IconName;
  onPress?: () => void;
  disabled?: boolean;
  /** "tab" inside SegmentedTabs, so the selection is announced as a tab, not a toggle. */
  role?: "button" | "tab";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      style={({ pressed }) => [s.chip, selected && s.on, pressed && !disabled && s.pressed]}
    >
      {icon ? <Icon name={icon} size="sm" color={selected ? C.white : C.primaryDark} /> : null}
      <Text style={[s.text, selected && s.textOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
});

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs + 2,
    minHeight: 34,
    paddingHorizontal: SPACE.md + 2,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: C.lavenderSoft,
  },
  on: { backgroundColor: C.primary },
  pressed: { opacity: 0.9 },
  text: { color: C.primaryDark, fontSize: 13, fontFamily: FONT.semibold },
  textOn: { color: C.white },
});
