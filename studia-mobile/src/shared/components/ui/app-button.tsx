// app-button.tsx — plain label-only button (welcome / auth / error fallback).
// ActionButton is the variant with an icon and a built-in double-submit lock; this one stays
// minimal, but both take their radius, spacing, type and shadow from the same tokens.
import { Pressable, StyleSheet, Text, type PressableProps } from "react-native";

import { C } from "@/shared/constants/studia-colors";
import { FONT, MIN_TOUCH, RADIUS, SHADOW, SPACE } from "@/shared/constants/tokens";

type Variant = "primary" | "secondary";

type AppButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: Variant;
};

export function AppButton({
  label,
  variant = "primary",
  disabled,
  ...rest
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        s.base,
        s[variant],
        pressed && !disabled && s.pressed,
        disabled && s.disabled,
      ]}
      {...rest}
    >
      <Text
        style={[
          s.label,
          variant === "primary" ? s.labelPrimary : s.labelSecondary,
          disabled && s.labelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH + 8,
    borderRadius: RADIUS.lg,
    // Both variants carry a border so their heights match exactly.
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: SPACE.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: C.primary, ...SHADOW.raised },
  secondary: { backgroundColor: C.lavenderSoft, borderColor: C.lavender },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  // No opacity on the disabled state: on Android, opacity + elevation draws a grey rectangle.
  disabled: {
    backgroundColor: C.lavenderSoft,
    borderColor: C.lavender,
    shadowOpacity: 0,
    elevation: 0,
  },
  label: { fontSize: 16, fontFamily: FONT.semibold },
  labelPrimary: { color: C.white },
  labelSecondary: { color: C.primaryDark },
  labelDisabled: { color: C.muted },
});
