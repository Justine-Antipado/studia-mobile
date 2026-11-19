// progress-bar.tsx — course progress, quiz progress, upload progress.
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { C, TONES, type Tone } from "@/shared/constants/studia-colors";
import { TYPE } from "@/shared/constants/tokens";

export const ProgressBar = memo(function ProgressBar({
  value,
  label,
  tone = "primary",
  height = 6,
}: {
  /** 0..1 — values outside the range (or NaN) are clamped. */
  value: number;
  label?: string;
  tone?: Tone;
  height?: number;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100);
  return (
    <View
      style={s.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? "Progress"}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      {label ? (
        <View style={s.labelRow}>
          <Text style={[TYPE.muted, s.label]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={TYPE.muted}>{pct}%</Text>
        </View>
      ) : null}
      <View style={[s.track, { height, borderRadius: height / 2 }]}>
        <View
          style={{
            width: `${pct}%`,
            height,
            borderRadius: height / 2,
            backgroundColor: TONES[tone].fg,
          }}
        />
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  label: { flexShrink: 1 },
  track: { backgroundColor: C.lavenderSoft, overflow: "hidden" },
});
