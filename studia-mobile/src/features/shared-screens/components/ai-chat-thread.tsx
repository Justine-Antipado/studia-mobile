// ai-chat-thread.tsx — scrolling message list for the AI assistant screen. Takes the
// ScrollView ref as a prop (not forwardRef) because the parent also drives it on keyboard events.
import { type ComponentRef, type RefObject } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { FONT, RADIUS, SHADOW, SPACE } from "@/shared/constants/tokens";

export type ChatMessage = { id: string; from: "user" | "ai"; text: string };

export function AiChatThread({
  messages,
  listRef,
}: {
  messages: ChatMessage[];
  listRef: RefObject<ComponentRef<typeof ScrollView> | null>;
}) {
  return (
    <ScrollView
      ref={listRef}
      style={s.flex}
      contentContainerStyle={s.list}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {messages.map((m) => {
        const isUser = m.from === "user";
        return (
          <View key={m.id} style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}>
            {!isUser && (
              <View style={s.aiBadge}>
                <Icon name="sparkles-outline" size="xs" color={C.primary} />
                <Text style={s.aiBadgeText}>AI-generated</Text>
              </View>
            )}
            <Text style={[s.msgText, { color: isUser ? C.white : C.text }]}>{m.text}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: SPACE.md, paddingVertical: SPACE.sm, flexGrow: 1 },
  bubble: { maxWidth: "88%", borderRadius: RADIUS.xxl - 4, padding: SPACE.md + 2, gap: SPACE.xs + 2 },
  userBubble: { alignSelf: "flex-end", backgroundColor: C.primary, borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: "flex-start", backgroundColor: C.white, borderBottomLeftRadius: 4, ...SHADOW.card },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    backgroundColor: C.lavenderSoft,
    alignSelf: "flex-start",
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.md,
  },
  aiBadgeText: { color: C.primary, fontSize: 10.5, fontFamily: FONT.semibold },
  msgText: { fontSize: 13.5, lineHeight: 20, fontFamily: FONT.regular },
});
