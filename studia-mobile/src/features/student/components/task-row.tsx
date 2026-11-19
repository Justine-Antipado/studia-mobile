// task-row.tsx — one checklist item in Home/To-do, backed by an assignment or quiz task.
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge, Icon } from "@/shared/components/ui";
import { C } from "@/shared/constants/studia-colors";
import { MIN_TOUCH, RADIUS, SHADOW, SPACE, TYPE } from "@/shared/constants/tokens";
import { dueLabel, isOverdue } from "@/features/student/logic/format";
import type { Task } from "@/features/student/types/student";

export const TaskRow = memo(function TaskRow({
  task,
  onToggle,
  onPress,
}: {
  task: Task;
  onToggle: () => void;
  onPress: () => void;
}) {
  const overdue = !task.done && isOverdue(task.dueAt);

  return (
    <View style={s.card}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={`Mark ${task.title} as ${task.done ? "not done" : "done"}`}
        style={[s.check, task.done && s.checkOn]}
      >
        {task.done ? <Icon name="checkmark" size="sm" color={C.white} /> : null}
      </Pressable>

      <Pressable onPress={onPress} style={s.text} accessibilityRole="button">
        <Text style={[TYPE.h3, task.done && s.done]} numberOfLines={2}>
          {task.title}
        </Text>
        <Text style={[TYPE.muted, overdue && s.overdue]} numberOfLines={1}>
          {task.classCode} · {dueLabel(task.dueAt)}
        </Text>
      </Pressable>

      <Badge label={task.kind === "quiz" ? "Quiz" : "Assignment"} tone={task.kind === "quiz" ? "blue" : "primary"} />
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
  overdue: { color: C.red },
});
