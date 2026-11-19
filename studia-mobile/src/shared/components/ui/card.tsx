// card.tsx — white rounded surface used by every screen. Pressable when onPress is given.
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { C } from "@/shared/constants/studia-colors";
import { RADIUS, SHADOW, SPACE } from "@/shared/constants/tokens";

type Props = {
  children: ReactNode;
  onPress?: () => void;
  /** flat = no shadow, for cards inside another card or on a white surface */
  flat?: boolean;
  padded?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  onPress,
  flat = false,
  padded = true,
  disabled,
  accessibilityLabel,
  style,
}: Props) {
  const base: StyleProp<ViewStyle> = [
    s.card,
    padded && s.padded,
    flat ? s.flat : SHADOW.card,
    style,
  ];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [base, pressed && !disabled && s.pressed]}
    >
      {children}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: RADIUS.xl },
  padded: { padding: SPACE.lg - 2 },
  flat: { borderWidth: 1, borderColor: C.border },
  pressed: { transform: [{ scale: 0.985 }] },
});
