// planner-week-grid.tsx — calendar/week view for the Study Planner: one column per day of the
// selected week, blocks positioned by their hour. A phone is too narrow for a readable label at
// 7 columns, so a block renders as a small colored chip; tapping it identifies/edits it. Marking
// done and deleting stay List-view actions (there is no room for a checkbox in a chip this size).
// Two blocks sharing the same day and hour simply overlap — rare enough for a personal planner
// that splitting them into side-by-side lanes isn't worth the complexity yet.
// Sits in a white card (same radius/shadow as every other Planner row) instead of bare grid lines
// floating on the screen background, and "today" is a filled circle on the date — like the
// calendar's own day picker — instead of tinting the whole column.
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { C, TONES, type Tone } from "@/shared/constants/studia-colors";
import { FONT, RADIUS, SHADOW, SPACE, TYPE } from "@/shared/constants/tokens";
import { addDaysIso, weekdayShort } from "@/features/student/logic/format";
import type { PlannerBlock, PlannerPriority } from "@/features/student/types/student";

const ROW_HEIGHT = 44;
const HOUR_COL_WIDTH = 36;
/** A typical day, widened only when a block actually falls outside it (e.g. a quiz due at 11:59 PM). */
const DEFAULT_LO_HOUR = 6;
const DEFAULT_HI_HOUR = 21;

const PRIORITY_TONE: Record<PlannerPriority, Tone> = { high: "red", medium: "blue", low: "green" };

/** 13 -> "1p", 0 -> "12a" — compact label for the narrow hour gutter. */
function shortHour(hour: number): string {
  const h = ((hour + 11) % 12) + 1;
  return `${h}${hour >= 12 ? "p" : "a"}`;
}

export const PlannerWeekGrid = memo(function PlannerWeekGrid({
  weekStartIso,
  blocks,
  todayIso,
  onPressBlock,
}: {
  /** Monday of the displayed week. */
  weekStartIso: string;
  blocks: PlannerBlock[];
  todayIso: string;
  onPressBlock: (block: PlannerBlock) => void;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStartIso, i)), [weekStartIso]);

  const weekBlocks = useMemo(() => {
    const first = days[0];
    const last = days[6];
    return blocks.filter((b) => b.dayIso >= first && b.dayIso <= last);
  }, [blocks, days]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlannerBlock[]>(days.map((d) => [d, [] as PlannerBlock[]]));
    for (const b of weekBlocks) map.get(b.dayIso)?.push(b);
    return map;
  }, [weekBlocks, days]);

  const [loHour, hiHour] = useMemo(() => {
    let lo = DEFAULT_LO_HOUR;
    let hi = DEFAULT_HI_HOUR;
    for (const b of weekBlocks) {
      lo = Math.min(lo, b.startHour);
      hi = Math.max(hi, b.startHour + b.durationHours - 1);
    }
    return [lo, hi];
  }, [weekBlocks]);
  const hours = useMemo(() => Array.from({ length: hiHour - loHour + 1 }, (_, i) => i + loHour), [loHour, hiHour]);
  const gridHeight = hours.length * ROW_HEIGHT;

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={{ width: HOUR_COL_WIDTH }} />
        {days.map((d) => {
          const isToday = d === todayIso;
          return (
            <View key={d} style={s.dayHead}>
              <Text style={[TYPE.caption, isToday && s.todayLabel]}>{weekdayShort(d)}</Text>
              <View style={[s.dayNum, isToday && s.dayNumToday]}>
                <Text style={[TYPE.h3, isToday && s.dayNumTextToday]}>{Number(d.slice(8, 10))}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={[s.body, { height: gridHeight }]}>
        <View style={{ width: HOUR_COL_WIDTH }}>
          {hours.map((h) => (
            <View key={h} style={[s.hourCell, { height: ROW_HEIGHT }]}>
              <Text style={TYPE.caption}>{shortHour(h)}</Text>
            </View>
          ))}
        </View>

        {days.map((d) => (
          <View key={d} style={[s.dayCol, d === todayIso && s.dayColToday]}>
            {hours.map((h) => (
              <View key={h} style={[s.rowLine, { height: ROW_HEIGHT }]} />
            ))}
            {(byDay.get(d) ?? []).map((block) => {
              const tone = TONES[PRIORITY_TONE[block.priority]];
              const top = (block.startHour - loHour) * ROW_HEIGHT;
              const height = block.durationHours * ROW_HEIGHT - 3;
              return (
                <Pressable
                  key={block.id}
                  onPress={() => onPressBlock(block)}
                  accessibilityRole="button"
                  accessibilityLabel={block.title}
                  style={[s.chip, { top, height, backgroundColor: block.done ? C.lavenderSoft : tone.fg }]}
                >
                  <Text
                    style={[s.chipText, block.done && s.chipTextDone]}
                    numberOfLines={height > ROW_HEIGHT ? 2 : 1}
                  >
                    {block.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: RADIUS.xl,
    padding: SPACE.md,
    ...SHADOW.card,
  },
  headerRow: { flexDirection: "row" },
  dayHead: { flex: 1, alignItems: "center", gap: 4, paddingBottom: SPACE.sm },
  todayLabel: { color: C.primary, fontFamily: FONT.semibold },
  dayNum: { width: 28, height: 28, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
  dayNumToday: { backgroundColor: C.primary },
  dayNumTextToday: { color: C.white },
  body: { flexDirection: "row" },
  hourCell: { alignItems: "flex-end", paddingRight: 6 },
  rowLine: { borderTopWidth: 1, borderColor: C.border },
  dayCol: { flex: 1, position: "relative", borderLeftWidth: 1, borderColor: C.border },
  dayColToday: { backgroundColor: C.lavenderSoft },
  chip: {
    position: "absolute",
    left: 2,
    right: 2,
    borderRadius: RADIUS.md,
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: "center",
  },
  chipText: { ...TYPE.caption, color: C.white, fontFamily: FONT.semibold },
  chipTextDone: { color: C.muted, textDecorationLine: "line-through" },
});
