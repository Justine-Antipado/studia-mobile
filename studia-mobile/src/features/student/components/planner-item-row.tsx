// planner-item-row.tsx — one plan or auto-placed task row in the Study Planner list.
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge, Icon } from "@/shared/components/ui";
import { C } from "@/shared/constants/studia-colors";
import { MIN_TOUCH, RADIUS, SHADOW, SPACE, TYPE } from "@/shared/constants/tokens";
import { dayLabel, hourLabel } from "@/features/student/logic/format";
import type { PlannerBlock, PlannerPriority } from "@/features/student/types/student";

const PRIORITY_BADGE: Record<PlannerPriority, { label: string; tone: "red" | "blue" | "green" }> = {
  high: { label: "High priority", tone: "red" },
  medium: { label: "Medium priority", tone: "blue" },
  low: { label: "Low priority", tone: "green" },
};

export const PlannerItemRow = memo(function PlannerItemRow({
  block,
  onToggleDone,
  onPress,
}: {
  block: PlannerBlock;
  onToggleDone: () => void;
  /** Opens the manual plan for editing; omitted for an auto task block, which has nothing of its
   *  own to edit (mark-done already syncs with the assignment/quiz behind it). */
  onPress?: () => void;
}) {
  const badge = block.done ? { label: "Done", tone: "green" as const } : PRIORITY_BADGE[block.priority];

  return (
    <View style={s.card}>
      <Pressable
        onPress={onToggleDone}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: block.done }}
        accessibilityLabel={`Mark ${block.title} as ${block.done ? "not done" : "done"}`}
        style={[s.check, block.done && s.checkOn]}
      >
        {block.done ? <Icon name="checkmark" size="sm" color={C.white} /> : null}
      </Pressable>

      <Pressable onPress={onPress} disabled={!onPress} style={s.text} accessibilityRole="button">
        <Text style={[TYPE.h3, block.done && s.done]} numberOfLines={2}>
          {block.title}
        </Text>
        <Text style={TYPE.muted} numberOfLines={1}>
          {dayLabel(block.dayIso)} · {hourLabel(block.startHour)}
        </Text>
        {block.notes ? (
          <Text style={TYPE.caption} numberOfLines={1}>
            {block.notes}
          </Text>
        ) : null}
      </Pressable>

      <Badge label={badge.label} tone={badge.tone} />
    </View>
  );
});

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    backgroundColor: C.white,
    borderRadius: RADIUS.xl,
    padding: SPACE.lg - 2,
    ...SHADOW.card,
  },
  check: {
    width: MIN_TOUCH - 12,
    height: MIN_TOUCH - 12,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: C.lavender,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: C.green, borderColor: C.green },
  text: { flex: 1, gap: 2 },
  done: { color: C.muted, textDecorationLine: "line-through" },
});
