// badge.tsx — status / count label. One tone scale for the whole app (TONES in studia-colors).
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { C, TONES, type Tone } from "@/shared/constants/studia-colors";
import { FONT, RADIUS, SPACE } from "@/shared/constants/tokens";

export const Badge = memo(function Badge({
  label,
  tone = "primary",
  solid = false,
}: {
  label: string | number;
  tone?: Tone;
  solid?: boolean;
}) {
  const c = TONES[tone];
  return (
    <View
      style={[s.box, { backgroundColor: solid ? c.fg : c.bg, borderColor: solid ? c.fg : c.border }]}
    >
      <Text style={[s.text, { color: solid ? C.white : c.strong }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

const s = StyleSheet.create({
  box: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.sm + 2,
    paddingVertical: 3,
  },
  text: { fontSize: 11, lineHeight: 16, fontFamily: FONT.semibold },
});
