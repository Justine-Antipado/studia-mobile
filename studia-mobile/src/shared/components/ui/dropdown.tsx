// dropdown.tsx — CustomDropdown: the ONE dropdown of the app. Replaces chip rows and
// SegmentedTabs wherever the choice is a single value out of a list that can grow (class pickers,
// sub-navigation, question type / Bloom / difficulty, personal-info fields, alert filters).
//   variant="field" — form control: label above, bordered box, helper/error underneath
//   variant="nav"   — compact pill used as in-screen sub-navigation (Stream / Lessons / …)
// Options open in a BottomSheet; a search box appears above SEARCH_THRESHOLD options (or when
// `searchable` is set), so a hundred classes stay usable.
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { BottomSheet } from "@/shared/components/ui/bottom-sheet";
import { Icon, type IconName } from "@/shared/components/ui/icon";
import { ListRow } from "@/shared/components/ui/list-row";
import { C } from "@/shared/constants/studia-colors";
import { FONT, MIN_TOUCH, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  /** Second line in the sheet (not shown on the trigger). */
  description?: string;
  /** Leading icon in the sheet row. */
  icon?: IconName;
  /** Small trailing text in the sheet row (a count, for example). */
  meta?: string;
};

/** Above this many options the sheet gets a search box on its own. */
const SEARCH_THRESHOLD = 8;

/**
 * Turns a list of plain values (COURSES, YEARS, DEPARTMENTS…) into options, optionally with a
 * friendlier label. The value is what gets stored, so it stays exactly as given.
 */
export function toOptions<T extends string>(
  values: readonly T[],
  label?: (value: T) => string,
): DropdownOption<T>[] {
  return values.map((value) => ({ value, label: label ? label(value) : value }));
}

export type CustomDropdownProps<T extends string> = {
  options: readonly DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Field label (also the sheet title unless `sheetTitle` is given). */
  label?: string;
  sheetTitle?: string;
  /** Trigger text when `value` matches no option. */
  placeholder?: string;
  helper?: string;
  error?: string;
  disabled?: boolean;
  /** Force the search box on. It is on by default above SEARCH_THRESHOLD options. */
  searchable?: boolean;
  variant?: "field" | "nav";
  /** Icon shown on a "nav" trigger before the label. */
  icon?: IconName;
  testID?: string;
};

export function CustomDropdown<T extends string>({
  options,
  value,
  onChange,
  label,
  sheetTitle,
  placeholder = "Select…",
  helper,
  error,
  disabled = false,
  searchable,
  variant = "field",
  icon,
  testID,
}: CustomDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = options.find((o) => o.value === value);
  const title = sheetTitle ?? label ?? "Select an option";
  const withSearch = searchable ?? options.length > SEARCH_THRESHOLD;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const pick = (next: T) => {
    onChange(next);
    close();
  };

  const nav = variant === "nav";

  return (
    <View style={nav ? undefined : s.wrap}>
      {label && !nav ? <Text style={TYPE.label}>{label}</Text> : null}

      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        accessibilityLabel={`${label ?? title}: ${current?.label ?? "none selected"}. Tap to change`}
        style={({ pressed }) => [
          nav ? s.nav : s.box,
          !!error && !nav && s.boxError,
          disabled && s.disabled,
          pressed && !disabled && s.pressed,
        ]}
      >
        {nav && icon ? <Icon name={icon} size="sm" color={C.primary} /> : null}
        <Text style={[nav ? s.navValue : s.value, !current && s.placeholder]} numberOfLines={1}>
          {current?.label ?? placeholder}
        </Text>
        <Icon name="chevron-down" size="sm" color={nav ? C.primary : C.muted} />
      </Pressable>

      {error ? <Text style={s.error}>{error}</Text> : helper ? <Text style={TYPE.caption}>{helper}</Text> : null}

      <BottomSheet visible={open} title={title} onClose={close}>
        {withSearch ? (
          <View style={s.search}>
            <Icon name="search-outline" size="sm" color={C.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={C.muted}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel={`Search ${title}`}
              style={s.searchInput}
            />
          </View>
        ) : null}

        {visible.length === 0 ? (
          <Text style={[TYPE.muted, s.empty]}>No match for “{query.trim()}”.</Text>
        ) : (
          visible.map((o) => (
            <ListRow
              key={o.value}
              flat
              chevron={false}
              icon={o.icon ?? (o.value === value ? "radio-button-on" : "radio-button-off")}
              iconBg={o.value === value ? C.lavenderSoft : undefined}
              title={o.label}
              subtitle={o.description}
              trailing={
                o.meta ? (
                  <Text style={TYPE.muted}>{o.meta}</Text>
                ) : o.value === value ? (
                  <Icon name="checkmark" size="md" color={C.primary} />
                ) : undefined
              }
              onPress={() => pick(o.value)}
            />
          ))
        )}
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: SPACE.xs },
  box: {
    minHeight: MIN_TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  boxError: { borderColor: C.red },
  nav: {
    minHeight: MIN_TOUCH - 8,
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: C.lavenderSoft,
    borderWidth: 1,
    borderColor: C.lavender,
  },
  value: { flex: 1, fontSize: 14, color: C.text, fontFamily: FONT.semibold },
  navValue: { flexShrink: 1, fontSize: 14, color: C.primaryDark, fontFamily: FONT.semibold },
  placeholder: { color: C.muted, fontFamily: FONT.regular },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  error: { ...TYPE.caption, color: C.red },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: C.surface,
  },
  searchInput: {
    flex: 1,
    minHeight: MIN_TOUCH - 8,
    fontSize: 14,
    color: C.text,
    fontFamily: FONT.regular,
  },
  empty: { paddingVertical: SPACE.md, textAlign: "center" },
});
