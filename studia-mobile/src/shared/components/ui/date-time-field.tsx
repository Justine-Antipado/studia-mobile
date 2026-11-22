// date-time-field.tsx — labelled date + time picker (native pickers, no typed dates).
// Android: the system date dialog, then the system time dialog. iOS: a spinner in a bottom sheet.
// The value is a real Date, so there is no "2026-13-45" to validate; range rules (e.g. not in the
// past) belong to the caller via `error`.
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "@/shared/components/ui/action-button";
import { BottomSheet } from "@/shared/components/ui/bottom-sheet";
import { Icon } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { FONT, MIN_TOUCH, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";

const LOCALE = "en-PH";

export const formatDateTime = (d: Date) =>
  `${d.toLocaleDateString(LOCALE, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" })}`;

export const formatDate = (d: Date) =>
  d.toLocaleDateString(LOCALE, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

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
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(value);

  const open = useCallback(() => {
    if (Platform.OS === "ios") {
      setIosDraft(value);
      setIosOpen(true);
      return;
    }
    DateTimePickerAndroid.open({
      value,
      mode: "date",
      minimumDate,
      onValueChange: (_e: unknown, date: Date) => {
        if (mode === "date") {
          onChange(date);
          return;
        }
        // Keep the chosen time of day while the date changes, then ask for the time.
        const withDate = new Date(date);
        withDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
        DateTimePickerAndroid.open({
          value: withDate,
          mode: "time",
          onValueChange: (_e2: unknown, time: Date) => onChange(time),
        });
      },
    });
  }, [value, minimumDate, onChange, mode]);

  return (
    <View style={s.wrap}>
      <Text style={TYPE.label}>{label}</Text>
      <Pressable
        onPress={open}
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

      {Platform.OS === "ios" ? (
        <BottomSheet visible={iosOpen} title={label} onClose={() => setIosOpen(false)} scroll={false}>
          <DateTimePicker
            value={iosDraft}
            mode={mode}
            display="spinner"
            minimumDate={minimumDate}
            onValueChange={(_e: unknown, date: Date) => setIosDraft(date)}
          />
          <ActionButton
            label="Done"
            icon="checkmark"
            onPress={() => {
              onChange(iosDraft);
              setIosOpen(false);
            }}
          />
        </BottomSheet>
      ) : null}
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
});
