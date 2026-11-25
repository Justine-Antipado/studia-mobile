// filter-pill-sheet.tsx — the one list/feed filter control: a compact "Filters" pill (sliders icon,
// active-count badge) that opens a fixed-height bottom sheet with the options plus Reset / Apply.
// Pure view state: the screen keeps its own filter value and its existing client-side filtering;
// nothing here touches a repository or query. NOT for data-entry forms (those keep CustomDropdown
// / SelectField).
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { ActionButton } from "@/shared/components/ui/action-button";
import { BottomSheet } from "@/shared/components/ui/bottom-sheet";
import { Icon } from "@/shared/components/ui/icon";
import { ListRow } from "@/shared/components/ui/list-row";
import { C } from "@/shared/constants/studia-colors";
import { FONT, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";

export type FilterOption = {
  value: string;
  label: string;
  /** Small trailing text (a count, for example). */
  meta?: string;
};

export type FilterGroup = {
  key: string;
  title: string;
  options: readonly FilterOption[];
};

/** One selected value per group key. */
export type FilterValues = Record<string, string>;

/** The sheet never resizes with its content: a share of the window, clamped. */
const SHEET_SHARE = 0.6;
const SHEET_MIN = 380;
const SHEET_MAX = 560;

export function FilterPillSheet({
  groups,
  value,
  defaults,
  onApply,
  title = "Filters",
}: {
  groups: readonly FilterGroup[];
  value: FilterValues;
  /** What "no filter" means per group; Reset returns to it and the badge counts the differences. */
  defaults: FilterValues;
  onApply: (next: FilterValues) => void;
  title?: string;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(Math.min(Math.max(windowHeight * SHEET_SHARE, SHEET_MIN), SHEET_MAX));

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterValues>(value);

  const activeCount = groups.filter((g) => value[g.key] !== defaults[g.key]).length;
  const active = activeCount > 0;

  const show = useCallback(() => {
    setDraft(value); // always start from what is applied, never from an abandoned draft
    setOpen(true);
  }, [value]);
  const close = useCallback(() => setOpen(false), []);
  const reset = useCallback(() => setDraft(defaults), [defaults]);
  const apply = useCallback(() => {
    onApply(draft);
    setOpen(false);
  }, [draft, onApply]);

  return (
    <>
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={active ? `Filters, ${activeCount} active` : "Filters"}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [s.pill, active && s.pillOn, pressed && s.pressed]}
      >
        <Icon name="options-outline" size="sm" color={active ? C.white : C.primary} />
        <Text style={[s.label, active && s.labelOn]} numberOfLines={1}>
          Filters
        </Text>
        {active ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{activeCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <BottomSheet visible={open} title={title} onClose={close} scroll={false} height={sheetHeight}>
        <View style={s.fill}>
          <ScrollView
            style={s.fill}
            contentContainerStyle={s.groups}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {groups.map((g) => (
              <View key={g.key} style={s.group}>
                <Text style={TYPE.label}>{g.title}</Text>
                {g.options.map((o) => {
                  const selected = draft[g.key] === o.value;
                  return (
                    <ListRow
                      key={o.value}
                      flat
                      chevron={false}
                      icon={selected ? "radio-button-on" : "radio-button-off"}
                      iconBg={selected ? C.lavenderSoft : undefined}
                      title={o.label}
                      trailing={o.meta ? <Text style={TYPE.muted}>{o.meta}</Text> : undefined}
                      onPress={() => setDraft((d) => ({ ...d, [g.key]: o.value }))}
                    />
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={s.footer}>
            <ActionButton label="Reset" variant="secondary" onPress={reset} style={s.action} />
            <ActionButton label="Apply" onPress={apply} style={s.action} />
          </View>
        </View>
      </BottomSheet>
    </>
  );
}

const s = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs + 2,
    minHeight: 30,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs + 1,
    borderRadius: RADIUS.pill,
    backgroundColor: C.lavenderSoft,
    borderWidth: 1,
    borderColor: C.lavender,
  },
  pillOn: { backgroundColor: C.primary, borderColor: C.primary },
  pressed: { opacity: 0.9 },
  label: { color: C.primaryDark, fontSize: 13, fontFamily: FONT.semibold },
  labelOn: { color: C.white },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: SPACE.xs,
    borderRadius: RADIUS.pill,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: C.primary, fontSize: 11, lineHeight: 15, fontFamily: FONT.bold },
  fill: { flex: 1 },
  groups: { gap: SPACE.lg, paddingBottom: SPACE.sm },
  group: { gap: SPACE.sm },
  footer: { flexDirection: "row", gap: SPACE.md, paddingTop: SPACE.md },
  action: { flex: 1 },
});
