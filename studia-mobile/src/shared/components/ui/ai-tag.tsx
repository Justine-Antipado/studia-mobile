// ai-tag.tsx — marks content produced by the AI core (summary, transcript, generated quiz).
// Every AI-generated block must carry one so users can tell it apart from instructor content.
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { FONT, RADIUS, SPACE } from "@/shared/constants/tokens";

export const AiTag = memo(function AiTag({ text }: { text: string }) {
  return (
    <View style={s.tag}>
      <Icon name="sparkles-outline" size="xs" color={C.primary} />
      <Text style={s.text} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
});

const s = StyleSheet.create({
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    alignSelf: "flex-start",
    backgroundColor: C.lavenderSoft,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
  },
  text: { color: C.primary, fontSize: 10.5, fontFamily: FONT.semibold },
});
