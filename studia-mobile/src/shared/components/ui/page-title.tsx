// page-title.tsx — back arrow + title (+ optional subtitle and trailing action) for sub-pages.
// The onBack handler must come from useSafeBack(logicalParent).
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { HIT_SLOP, SPACE, TYPE } from "@/shared/constants/tokens";

export function PageTitle({
  title,
  subtitle,
  onBack,
  trailing,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View style={s.row}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={s.back}
        >
          <Icon name="chevron-back" size="lg" color={C.primaryDark} />
        </Pressable>
      ) : null}
      <View style={s.text}>
        <Text style={TYPE.h1} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={TYPE.muted} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

/** @deprecated use PageTitle */
export function BackTitle({ title, onBack }: { title: string; onBack: () => void }) {
  return <PageTitle title={title} onBack={onBack} />;
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm + 2 },
  text: { flex: 1, gap: 2 },
  back: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
