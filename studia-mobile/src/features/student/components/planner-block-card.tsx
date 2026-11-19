// planner-block-card.tsx — one study block in the Study Planner week grid.
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/shared/components/ui";
import { C } from "@/shared/constants/studia-colors";
import { RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";
import { hourLabel } from "@/features/student/logic/format";
import type { PlannerBlock } from "@/features/student/types/student";

export const PlannerBlockCard = memo(function PlannerBlockCard({
  block,
  onToggleDone,
  onMove,
}: {
  block: PlannerBlock;
  onToggleDone: () => void;
  onMove: () => void;
}) {
  return (
    <View style={[s.card, block.done && s.done]}>
      <Pressable onPress={onToggleDone} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: block.done }}>
        <Icon name={block.done ? "checkmark-circle" : "ellipse-outline"} size="lg" color={block.done ? C.green : C.muted} />
      </Pressable>
      <View style={s.text}>
        <Text style={TYPE.caption}>
          {hourLabel(block.startHour)} · {block.durationHours}h
        </Text>
        <Text style={[TYPE.body, block.done && s.doneText]} numberOfLines={2}>
          {block.title}
        </Text>
      </View>
      <Pressable onPress={onMove} hitSlop={8} accessibilityRole="button" accessibilityLabel="Move to another day">
        <Icon name="calendar-outline" size="sm" color={C.muted} />
      </Pressable>
    </View>
  );
});

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm + 2,
    backgroundColor: C.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: SPACE.md,
  },
  done: { backgroundColor: C.surface },
  text: { flex: 1, gap: 2 },
  doneText: { color: C.muted, textDecorationLine: "line-through" },
});
