// priority-task-card.tsx — one card in the Study Planner's "My Priority Task" horizontal carousel.
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/shared/components/ui";
import { C } from "@/shared/constants/studia-colors";
import { RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";
import { dayLabel } from "@/features/student/logic/format";

const BG = { blue: C.blue, orange: C.orange, red: C.red } as const;
type CardTone = keyof typeof BG;

export const PriorityTaskCard = memo(function PriorityTaskCard({
  title,
  notes,
  dayIso,
  icon,
  tone,
  onPress,
}: {
  title: string;
  notes: string;
  dayIso: string;
  icon: IconName;
  tone: CardTone;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[s.card, { backgroundColor: BG[tone] }]}>
      <View style={s.iconTile}>
        <Icon name={icon} size="md" color={C.white} />
      </View>
      <Text style={s.date} numberOfLines={1}>
        {dayLabel(dayIso)}
      </Text>
      <Text style={s.title} numberOfLines={2}>
        {title}
      </Text>
      {notes ? (
        <Text style={s.notes} numberOfLines={2}>
          {notes}
        </Text>
      ) : null}
    </Pressable>
  );
});

const s = StyleSheet.create({
  card: { width: 160, borderRadius: RADIUS.xl, padding: SPACE.lg - 2, gap: SPACE.xs + 2 },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.xs,
  },
  date: { ...TYPE.caption, color: "rgba(255,255,255,0.85)" },
  title: { ...TYPE.h3, color: C.white },
  notes: { ...TYPE.caption, color: "rgba(255,255,255,0.85)" },
});
