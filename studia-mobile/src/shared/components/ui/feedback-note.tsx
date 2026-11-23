// feedback-note.tsx — the instructor's note on a graded quiz or assignment, presented the same way
// everywhere the student can meet it (G2): the quiz result screen, the assignment detail, the
// Grades tab and the Tasks list. Pure UI; renders nothing when there is no feedback, so a caller
// can pass the value straight through.
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";

export function FeedbackNote({
  feedback,
  /** "compact" fits inside a list row's footer; the default stands on its own in a screen. */
  variant = "card",
  title = "Instructor feedback",
}: {
  feedback: string | null | undefined;
  variant?: "card" | "compact";
  title?: string;
}) {
  const text = feedback?.trim();
  if (!text) return null;

  const compact = variant === "compact";

  return (
    <View
      style={[s.box, compact && s.compact]}
      accessibilityLabel={`${title}: ${text}`}
      accessible
    >
      <Icon name="chatbubble-ellipses-outline" size="sm" color={C.primary} />
      <View style={s.body}>
        {compact ? null : <Text style={TYPE.label}>{title}</Text>}
        <Text style={TYPE.body} numberOfLines={compact ? 3 : undefined}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: C.lavenderSoft,
  },
  compact: { padding: SPACE.sm + 2, borderRadius: RADIUS.md },
  body: { flex: 1, gap: 2 },
});
