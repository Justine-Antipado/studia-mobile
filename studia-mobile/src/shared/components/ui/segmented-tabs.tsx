// segmented-tabs.tsx — in-screen tab strip (Stream · Lessons · Tasks · Grades · People).
// Stays inside the screen's content width (no negative-margin bleed, which clipped the last chip
// and overlapped siblings). Scrolls horizontally when the labels do not fit and keeps the selected item in view: the
// offset comes from each chip's measured position (onLayout), not from an assumed chip width,
// so it stays correct with long labels and at large font scales.
import { useCallback, useRef } from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type ScrollViewInstance } from "react-native";

import { Chip } from "@/shared/components/ui/chip";
import { SPACE } from "@/shared/constants/tokens";

type Props<T extends string> = {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Optional display text per item (the item itself stays the key/value). */
  formatLabel?: (item: T) => string;
  /** Announced to screen readers as the name of this tab set. */
  label?: string;
};

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  label = "Sections",
  formatLabel,
}: Props<T>) {
  const ref = useRef<ScrollViewInstance>(null);
  const offsets = useRef<Record<string, number>>({});
  const viewportWidth = useRef(0);

  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    viewportWidth.current = e.nativeEvent.layout.width;
  }, []);

  const select = useCallback(
    (item: T) => {
      onChange(item);
      const x = offsets.current[item];
      if (x === undefined) return;
      // Centre the chosen chip when we know how wide the strip is.
      const centered = viewportWidth.current ? x - viewportWidth.current / 2 : x;
      ref.current?.scrollTo({ x: Math.max(0, centered), animated: true });
    },
    [onChange],
  );

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onLayout={onViewportLayout}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={s.scroll}
      contentContainerStyle={s.content}
    >
      {items.map((item) => (
        <View
          key={item}
          onLayout={(e) => {
            offsets.current[item] = e.nativeEvent.layout.x + e.nativeEvent.layout.width / 2;
          }}
        >
          <Chip
            label={formatLabel ? formatLabel(item) : item}
            selected={item === value}
            role="tab"
            onPress={() => select(item)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 0 },
  content: { gap: SPACE.sm, alignItems: "center", paddingRight: SPACE.lg },
});
