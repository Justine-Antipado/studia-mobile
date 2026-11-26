// action-button.tsx — button with an optional icon and a built-in double-submit lock.
// AppButton stays the plain label-only button; this one is for actions that hit a repository.
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { Icon, type IconName } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { MIN_TOUCH, RADIUS, SHADOW, SPACE, TYPE } from "@/shared/constants/tokens";

export type ActionButtonProps = {
  label: string;
  icon?: IconName;
  variant?: "primary" | "secondary" | "danger";
  /** "sm" is the compact header/inline action (e.g. a "Post" or "Create" next to a SectionHeader),
   * never a page's main CTA. */
  size?: "md" | "sm";
  onPress?: () => void;
  disabled?: boolean;
  /** While true the button shows a spinner and ignores presses (no double-submit). */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ActionButton({
  label,
  icon,
  variant = "primary",
  size = "md",
  onPress,
  disabled,
  loading = false,
  style,
}: ActionButtonProps) {
  const locked = !!disabled || loading;
  const filled = variant !== "secondary";
  const fg = filled ? C.white : C.primaryDark;
  const bg = variant === "danger" ? C.red : variant === "primary" ? C.primary : C.lavenderSoft;
  const pressedBg = variant === "danger" ? C.redPressed : filled ? C.primaryDark : C.lavender;
  const compact = size === "sm";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: locked, busy: loading }}
      disabled={locked}
      onPress={onPress}
      // No opacity here: Android draws a rectangular shadow when opacity + elevation combine.
      style={({ pressed }) => [
        s.base,
        compact ? s.compact : s.regular,
        { backgroundColor: bg },
        filled ? (compact ? null : SHADOW.raised) : s.secondary,
        locked && s.locked,
        pressed && !locked && { backgroundColor: pressedBg },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Icon name={icon} size={compact ? "sm" : "md"} color={locked ? C.muted : fg} />
      ) : null}
      <Text style={[TYPE.button, compact && s.compactLabel, { color: locked ? C.muted : fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  regular: {
    minHeight: MIN_TOUCH + 4,
    paddingVertical: SPACE.md + 3,
    paddingHorizontal: SPACE.lg,
  },
  compact: {
    alignSelf: "flex-start",
    minHeight: MIN_TOUCH,
    paddingVertical: SPACE.xs + 2,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
  },
  compactLabel: { fontSize: 13 },
  secondary: { borderColor: C.lavender },
  locked: { backgroundColor: C.lavenderSoft, borderColor: C.lavender, shadowOpacity: 0, elevation: 0 },
});
