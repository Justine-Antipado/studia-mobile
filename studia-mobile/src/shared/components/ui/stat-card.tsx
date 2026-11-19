// stat-card.tsx — one metric in a row of cards (analytics, home stats, gradebook summary).
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { C, TONES, type Tone } from "@/shared/constants/studia-colors";
import { FONT, RADIUS, SHADOW, SPACE, TYPE } from "@/shared/constants/tokens";

export const StatCard = memo(function StatCard({
  label,
  value,
  tone,
  onPress,
}: {
  label: string;
  value: string | number;
  /** Tinted variant — use orange for "needs your action", red for problems. */
  tone?: Tone;
  onPress?: () => void;
}) {
  const c = tone ? TONES[tone] : null;
  const body = (
    <>
      <Text style={[TYPE.muted, c ? { color: c.strong } : null]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[s.value, c ? { color: c.fg } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </>
  );

  if (!onPress) return <View style={[s.card, c ? { backgroundColor: c.bg } : null]}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        s.card,
        c ? { backgroundColor: c.bg } : null,
        pressed && s.pressed,
      ]}
    >
      {body}
    </Pressable>
  );
});

const s = StyleSheet.create({
  card: {
    flex: 1,
    // Low enough that three fit side by side on a 320dp screen; the rows that hold them also
    // wrap, so a large font scale pushes them onto a second line rather than off the edge.
    minWidth: 84,
    backgroundColor: C.white,
    borderRadius: RADIUS.lg + 2,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg - 2,
    ...SHADOW.card,
  },
  value: { color: C.text, fontSize: 26, lineHeight: 34, fontFamily: FONT.bold },
  pressed: { transform: [{ scale: 0.98 }] },
});
