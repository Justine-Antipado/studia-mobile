// select-field.tsx — labelled dropdown: shows the current choice, opens a bottom sheet of options.
// Use for short fixed lists (late-submission policy, course, department) instead of chip rows.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/shared/components/ui/bottom-sheet";
import { Icon } from "@/shared/components/ui/icon";
import { ListRow } from "@/shared/components/ui/list-row";
import { C } from "@/shared/constants/studia-colors";
import { FONT, MIN_TOUCH, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";

export type SelectOption<T extends string> = { value: T; label: string; description?: string };

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  helper,
}: {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  helper?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <View style={s.wrap}>
      <Text style={TYPE.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? "none"}. Tap to change`}
        style={s.box}
      >
        <Text style={s.value} numberOfLines={1}>
          {current?.label ?? "Select…"}
        </Text>
        <Icon name="chevron-down" size="sm" color={C.muted} />
      </Pressable>
      {helper ? <Text style={TYPE.caption}>{helper}</Text> : null}

      <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
        {options.map((o) => (
          <ListRow
            key={o.value}
            icon={o.value === value ? "radio-button-on" : "radio-button-off"}
            title={o.label}
            subtitle={o.description}
            onPress={() => {
              onChange(o.value);
              setOpen(false);
            }}
          />
        ))}
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
});
