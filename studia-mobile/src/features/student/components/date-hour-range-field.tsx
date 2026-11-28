// date-hour-range-field.tsx — the Add Plan form's single date field: tap it to open one sheet
// with a month calendar (pick the day) and two scrolling hour wheels (From / To), instead of a
// separate scrolling date strip plus two list-style dropdowns for the time range. Plans snap to
// the hour, so the wheels show plain hour labels (0–23) rather than DateTimeField's hour/minute/
// period wheels. A shorter wheel (3 rows, not DateTimeField's 5) keeps the sheet from growing
// taller than the calendar above it needs it to be.
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "@/shared/components/ui/action-button";
import { BottomSheet } from "@/shared/components/ui/bottom-sheet";
import { formatDate, Wheel } from "@/shared/components/ui/date-time-field";
import { Icon } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { FONT, MIN_TOUCH, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";
import { hourLabel } from "@/features/student/logic/format";

const LOCALE = "en-PH";
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const CELL = `${100 / 7}%` as const;
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => hourLabel(h));
const WHEEL_ITEM_H = 34;
const WHEEL_ROWS = 3;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

export function DateHourRangeField({
  label,
  value,
  onChange,
  minimumDate,
  fromHour,
  toHour,
  onFromHourChange,
  onToHourChange,
}: {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  minimumDate?: Date;
  fromHour: number;
  toHour: number;
  onFromHourChange: (hour: number) => void;
  onToHourChange: (hour: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftDay, setDraftDay] = useState(value);
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const [draftFrom, setDraftFrom] = useState(fromHour);
  const [draftTo, setDraftTo] = useState(toHour);

  const show = useCallback(() => {
    setDraftDay(value);
    setMonth(new Date(value.getFullYear(), value.getMonth(), 1));
    setDraftFrom(fromHour);
    setDraftTo(toHour);
    setOpen(true);
  }, [value, fromHour, toHour]);

  const minDay = minimumDate ? startOfDay(minimumDate) : null;

  // Leading blanks align day 1 under its weekday.
  const cells = useMemo(() => {
    const lead = month.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [month]);

  const pickDay = (day: number) => {
    const next = new Date(draftDay);
    next.setFullYear(month.getFullYear(), month.getMonth(), day);
    setDraftDay(next);
  };

  const shiftMonth = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));

  const monthLabel = month.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
  const prevDisabled = !!minDay && new Date(month.getFullYear(), month.getMonth(), 0) < minDay;

  const summary = `${formatDate(value)} · ${hourLabel(fromHour)}–${hourLabel(toHour)}`;

  return (
    <View style={s.wrap}>
      <Text style={TYPE.label}>{label}</Text>
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${summary}. Tap to change`}
        style={s.box}
      >
        <Icon name="calendar-outline" size="md" color={C.primaryDark} />
        <Text style={s.value} numberOfLines={1}>
          {summary}
        </Text>
        <Icon name="chevron-down" size="sm" color={C.muted} />
      </Pressable>

      <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
        <View style={s.monthRow}>
          <Pressable
            onPress={() => shiftMonth(-1)}
            disabled={prevDisabled}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={[s.navBtn, prevDisabled && s.dim]}
          >
            <Icon name="chevron-back" size="md" color={C.primaryDark} />
          </Pressable>
          <Text style={TYPE.h3}>{monthLabel}</Text>
          <Pressable onPress={() => shiftMonth(1)} accessibilityRole="button" accessibilityLabel="Next month" style={s.navBtn}>
            <Icon name="chevron-forward" size="md" color={C.primaryDark} />
          </Pressable>
        </View>

        <View style={s.grid}>
          {WEEKDAYS.map((w, i) => (
            <View key={`w${i}`} style={s.cell}>
              <Text style={s.weekday}>{w}</Text>
            </View>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <View key={`b${i}`} style={s.cell} />;
            const date = new Date(month.getFullYear(), month.getMonth(), day);
            const disabled = !!minDay && date < minDay;
            const selected = sameDay(date, draftDay);
            return (
              <View key={day} style={s.cell}>
                <Pressable
                  onPress={() => pickDay(day)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={formatDate(date)}
                  style={[s.day, selected && s.daySelected]}
                >
                  <Text style={[s.dayText, selected && s.dayTextSelected, disabled && s.dim]}>{day}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={s.timeRow}>
          <Wheel
            label="from hour"
            items={HOUR_LABELS}
            index={draftFrom}
            onSelect={setDraftFrom}
            itemHeight={WHEEL_ITEM_H}
            visibleRows={WHEEL_ROWS}
          />
          <Text style={s.dash}>–</Text>
          <Wheel
            label="to hour"
            items={HOUR_LABELS}
            index={draftTo}
            onSelect={setDraftTo}
            itemHeight={WHEEL_ITEM_H}
            visibleRows={WHEEL_ROWS}
          />
        </View>

        <Text style={[TYPE.muted, s.summary]}>
          {formatDate(draftDay)} · {HOUR_LABELS[draftFrom]}–{HOUR_LABELS[draftTo]}
        </Text>

        <ActionButton
          label="Done"
          icon="checkmark"
          onPress={() => {
            onChange(draftDay);
            onFromHourChange(draftFrom);
            onToHourChange(draftTo);
            setOpen(false);
          }}
        />
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: SPACE.xs + 2 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  value: { flex: 1, color: C.text, fontSize: 14, fontFamily: FONT.regular },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: RADIUS.pill,
    backgroundColor: C.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  dim: { opacity: 0.35 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: CELL, alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  weekday: { color: C.muted, fontSize: 12, fontFamily: FONT.semibold },
  day: { width: 40, height: 40, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: C.primary },
  dayText: { color: C.text, fontSize: 14, fontFamily: FONT.regular },
  dayTextSelected: { color: C.white, fontFamily: FONT.bold },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  dash: { color: C.muted, fontSize: 18, fontFamily: FONT.semibold },
  summary: { textAlign: "center" },
});
