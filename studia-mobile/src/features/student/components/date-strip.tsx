// date-strip.tsx — the Add Plan form's quick date picker: a horizontal row of nearby days, always
// centered on the selected one. For a date further out, the form's own date field opens a full
// month picker.
import { memo, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { C } from "@/shared/constants/studia-colors";
import { FONT, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";
import { addDaysIso, weekdayShort } from "@/features/student/logic/format";

const SPAN_BACK = 3;
const SPAN_FORWARD = 10;

export const DateStrip = memo(function DateStrip({
  selectedIso,
  onSelect,
}: {
  selectedIso: string;
  onSelect: (dayIso: string) => void;
}) {
  const days = useMemo(
    () => Array.from({ length: SPAN_BACK + SPAN_FORWARD + 1 }, (_, i) => addDaysIso(selectedIso, i - SPAN_BACK)),
    [selectedIso],
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.content}>
      {days.map((dayIso) => {
        const selected = dayIso === selectedIso;
        return (
          <Pressable
            key={dayIso}
            onPress={() => onSelect(dayIso)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[s.cell, selected && s.cellSelected]}
          >
            <Text style={[TYPE.caption, selected && s.textSelected]}>{weekdayShort(dayIso)}</Text>
            <Text style={[TYPE.h3, selected && s.textSelected]}>{Number(dayIso.slice(8, 10))}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const s = StyleSheet.create({
  content: { gap: SPACE.sm, paddingVertical: SPACE.xs },
  cell: {
    width: 52,
    height: 64,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  cellSelected: { backgroundColor: C.primary, borderColor: C.primary },
  textSelected: { color: C.white, fontFamily: FONT.semibold },
});
