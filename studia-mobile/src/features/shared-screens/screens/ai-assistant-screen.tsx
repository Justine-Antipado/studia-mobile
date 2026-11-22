// ai-assistant-screen.tsx — chat with STUDIA AI. One implementation, role-aware via `role`
// (seed messages, suggestions and subtitle come from CHAT_CONFIG[role]).
// TODO(refactor): route chat through an ai-service/data layer instead of mock-data directly.
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Keyboard, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { CHAT_CONFIG, mockReply } from "@/core/data/mock/mock-data";
import type { Role } from "@/core/types/role";
import { AiChatComposer } from "@/features/shared-screens/components/ai-chat-composer";
import { AiChatThread, type ChatMessage } from "@/features/shared-screens/components/ai-chat-thread";
import { Icon } from "@/shared/components/ui/icon";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";

export function AiAssistantScreen({ role }: { role: Role }) {
  const cfg = CHAT_CONFIG[role];
  const [messages, setMessages] = useState<ChatMessage[]>(cfg.seed);
  const [input, setInput] = useState("");
  const listRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // Keyboard avoidance now comes from Screen (KeyboardAvoidingView, "padding" on both platforms):
  // the old manual measureInWindow/screenY padding double-counted or read 0 under Android
  // edge-to-edge. Here we only keep the newest message in view when the keyboard opens.
  useEffect(() => {
    const evt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const show = Keyboard.addListener(evt, () => {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    return () => show.remove();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [messages.length]);

  const send = (textToSend?: string) => {
    const q = (textToSend ?? input).trim();
    if (!q) return;
    const userMsg: ChatMessage = { id: String(Date.now()), from: "user", text: q };
    const aiMsg: ChatMessage = { id: String(Date.now() + 1), from: "ai", text: mockReply(role, q) };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    if (!textToSend) setInput("");
  };

  return (
    <Screen role={role} scroll={false} contentStyle={s.fixed} scope={`${role}/ai`}>
      <View style={s.flex}>
        <View style={s.header}>
          <View style={s.avatar}>
            <Icon name="sparkles" size="md" color={C.white} />
          </View>
          <View style={s.flex}>
            <Text style={TYPE.h2}>STUDIA AI</Text>
            <Text style={TYPE.muted} numberOfLines={1}>
              {cfg.subtitle}
            </Text>
          </View>
        </View>

        <AiChatThread messages={messages} listRef={listRef} />
        <AiChatComposer suggestions={cfg.suggestions} input={input} onChangeInput={setInput} onSend={send} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  fixed: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  header: { flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingBottom: SPACE.sm + 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
