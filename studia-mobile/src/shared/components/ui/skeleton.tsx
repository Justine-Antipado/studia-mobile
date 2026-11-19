// skeleton.tsx — loading placeholders. Shimmer runs on the UI thread (Reanimated worklet)
// and is disabled when the OS reduce-motion setting is on.
import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { C } from "@/shared/constants/studia-colors";
import { RADIUS, SPACE } from "@/shared/constants/tokens";

export function Skeleton({
  width = "100%",
  height = 14,
  radius = RADIUS.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(withTiming(1, { duration: 750 }), -1, true);
  }, [pulse, reduced]);

  const animated = useAnimatedStyle(() => ({ opacity: reduced ? 0.7 : pulse.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: C.lavenderSoft }, animated, style]}
    />
  );
}

/** Card-shaped placeholder matching ListRow, so lists do not jump when data arrives. */
export function SkeletonRow() {
  return (
    <View style={s.card}>
      <Skeleton width={46} height={46} radius={RADIUS.lg} />
      <View style={s.text}>
        <Skeleton width="40%" height={10} />
        <Skeleton width="80%" height={14} />
        <Skeleton width="60%" height={10} />
      </View>
    </View>
  );
}

/** `count` placeholder rows — the default loading state of every list. */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    // One "Loading" announcement for the whole block: a screen reader must not read out a
    // dozen empty placeholder rows (the individual bars are already hidden from a11y).
    <View style={s.list} accessible accessibilityRole="progressbar" accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: SPACE.md + 2 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    backgroundColor: C.white,
    borderRadius: RADIUS.xl,
    padding: SPACE.lg - 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  text: { flex: 1, gap: 6 },
});
