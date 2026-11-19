// bar-chart.tsx — simple horizontal bar chart for Smart Analytics (docs/UI-BRIEF: "simple
// charts, no heavy library"). Percent-based viewBox so bars scale to any container width.
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { C, TONES, type Tone } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";

export type BarChartRow = { label: string; sublabel?: string; percent: number };

function BarChartBase({ rows, tone = "primary" }: { rows: BarChartRow[]; tone?: Tone }) {
  const color = TONES[tone].fg;
  return (
    <View style={{ gap: SPACE.md }}>
      {rows.map((row, i) => (
        <View key={i} style={{ gap: 4 }}>
          <View style={s.labelRow}>
            <Text style={TYPE.body} numberOfLines={1}>
              {row.label}
              {row.sublabel ? <Text style={TYPE.caption}> · {row.sublabel}</Text> : null}
            </Text>
            <Text style={TYPE.bodyStrong}>{row.percent}%</Text>
          </View>
          <Svg width="100%" height={10} viewBox="0 0 100 10" accessibilityLabel={`${row.label}: ${row.percent}%`}>
            <Rect x={0} y={0} width={100} height={10} rx={5} fill={C.border} />
            <Rect x={0} y={0} width={Math.max(0, Math.min(100, row.percent))} height={10} rx={5} fill={color} />
          </Svg>
        </View>
      ))}
    </View>
  );
}

export const BarChart = memo(BarChartBase);

const s = StyleSheet.create({
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: SPACE.sm },
});
