// date-time-field.tsx — labelled date + time picker. One custom bottom-sheet picker (month grid +
// time steppers) on BOTH iOS and Android, so the two platforms look and behave identically and
// no native picker module is involved (the iOS spinner rendered blank inside the sheet).
// The value is a real Date, so there is no "2026-13-45" to validate; range rules (e.g. not in the
// past) belong to the caller via `error`.
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "@/shared/components/ui/action-button";
import { BottomSheet } from "@/shared/components/ui/bottom-sheet";
import { Icon } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { FONT, MIN_TOUCH, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";

const LOCALE = "en-PH";
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const CELL = `${100 / 7}%` as const;

export const formatDateTime = (d: Date) =>
  `${d.toLocaleDateString(LOCALE, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" })}`;

export const formatDate = (d: Date) =>
  d.toLocaleDateString(LOCALE, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

function Stepper({ label, text, onUp, onDown }: { label: string; text: string; onUp: () => void; onDown: () => void }) {
  return (
    <View style={s.stepper}>
      <Pressable onPress={onUp} accessibilityRole="button" accessibilityLabel={`Increase ${label}`} style={s.stepBtn}>
        <Icon name="chevron-up" size="md" color={C.primaryDark} />
      </Pressable>
      <Text style={s.stepValue} accessibilityLabel={`${label} ${text}`}>
        {text}
      </Text>
      <Pressable onPress={onDown} accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} style={s.stepBtn}>
        <Icon name="chevron-down" size="md" color={C.primaryDark} />
      </Pressable>
    </View>
  );
}

export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
  error,
  helper,
  mode = "datetime",
}: {
  /** "date" for plain calendar dates (exam day); "datetime" adds a time of day (deadlines). */
  mode?: "date" | "datetime";
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  minimumDate?: Date;
  error?: string | null;
  helper?: string;
}) {
  const shown = mode === "date" ? formatDate(value) : formatDateTime(value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  const show = useCallback(() => {
    setDraft(value);
    setMonth(new Date(value.getFullYear(), value.getMonth(), 1));
    setOpen(true);
  }, [value]);

  const minDay = minimumDate ? startOfDay(minimumDate) : null;

  // Leading blanks align day 1 under its weekday.
  const cells = useMemo(() => {
    const lead = month.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [month]);

  const pickDay = (day: number) => {
    const next = new Date(draft);
    next.setFullYear(month.getFullYear(), month.getMonth(), day);
    setDraft(next);
  };

  const shiftMonth = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));

  const hours24 = draft.getHours();
  const isPm = hours24 >= 12;
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const setTime = (h: number, m: number) => {
    const next = new Date(draft);
    next.setHours(h, m, 0, 0);
    setDraft(next);
  };

  const monthLabel = month.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
  const prevDisabled = !!minDay && new Date(month.getFullYear(), month.getMonth(), 0) < minDay;

  return (
    <View style={s.wrap}>
      <Text style={TYPE.label}>{label}</Text>
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}. Tap to change`}
        style={[s.box, !!error && s.boxError]}
      >
        <Icon name="calendar-outline" size="md" color={C.primaryDark} />
        <Text style={s.value} numberOfLines={1}>
          {shown}
        </Text>
        <Icon name="chevron-down" size="sm" color={C.muted} />
      </Pressable>
      {error ? <Text style={s.error}>{error}</Text> : helper ? <Text style={TYPE.caption}>{helper}</Text> : null}

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
            const selected = sameDay(date, draft);
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

        {mode === "datetime" ? (
          <View style={s.timeRow}>
            <Stepper
              label="hour"
              text={String(hour12)}
              onUp={() => setTime(((hours24 + 1) % 12) + (isPm ? 12 : 0), draft.getMinutes())}
              onDown={() => setTime(((hours24 + 11) % 12) + (isPm ? 12 : 0), draft.getMinutes())}
            />
            <Text style={s.colon}>:</Text>
            <Stepper
              label="minute"
              text={String(draft.getMinutes()).padStart(2, "0")}
              onUp={() => setTime(hours24, (draft.getMinutes() + 5) % 60)}
              onDown={() => setTime(hours24, (draft.getMinutes() + 55) % 60)}
            />
            <View style={s.ampm}>
              {(["AM", "PM"] as const).map((p) => {
                const active = (p === "PM") === isPm;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setTime((hours24 % 12) + (p === "PM" ? 12 : 0), draft.getMinutes())}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[s.ampmBtn, active && s.ampmActive]}
                  >
                    <Text style={[s.ampmText, active && s.ampmTextActive]}>{p}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Text style={[TYPE.muted, s.summary]}>{mode === "date" ? formatDate(draft) : formatDateTime(draft)}</Text>

        <ActionButton
          label="Done"
          icon="checkmark"
          onPress={() => {
            onChange(draft);
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
  boxError: { borderColor: C.red },
  value: { flex: 1, color: C.text, fontSize: 14, fontFamily: FONT.regular },
  error: { color: C.red, fontSize: 12, fontFamily: FONT.regular },
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
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.md },
  stepper: { alignItems: "center", gap: SPACE.xs },
  stepBtn: {
    width: MIN_TOUCH,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: C.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { minWidth: 56, textAlign: "center", color: C.text, fontSize: 26, lineHeight: 34, fontFamily: FONT.bold },
  colon: { color: C.text, fontSize: 26, fontFamily: FONT.bold },
  ampm: { gap: SPACE.xs, marginLeft: SPACE.sm },
  ampmBtn: {
    minWidth: 56,
    minHeight: MIN_TOUCH - 6,
    borderRadius: RADIUS.md,
    backgroundColor: C.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  ampmActive: { backgroundColor: C.primary },
  ampmText: { color: C.primaryDark, fontSize: 14, fontFamily: FONT.semibold },
  ampmTextActive: { color: C.white },
  summary: { textAlign: "center" },
});
