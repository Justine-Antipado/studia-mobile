// ai-assistant-screen.tsx — chat with STUDIA AI. One implementation, role-aware via `role`
// (suggestions and subtitle come from CHAT_CONFIG[role]).
// Replies come from studia-api (ai-chat-repository); the AI key never ships in the app.
import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { Keyboard, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Role } from "@/core/types/role";
import { aiChatRepository } from "@/features/shared-screens/data/ai-chat-repository";
import { AiChatComposer } from "@/features/shared-screens/components/ai-chat-composer";
import { AiChatThread, type ChatMessage } from "@/features/shared-screens/components/ai-chat-thread";
import { Icon } from "@/shared/components/ui/icon";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";

const CHAT_CONFIG: Record<Role, { subtitle: string; suggestions: string[] }> = {
  instructor: {
    subtitle: "Ask anything about your classes",
    suggestions: ["Lesson plan draft", "Quiz generation", "Class summary"],
  },
  student: {
    subtitle: "Ask anything about your lessons",
    suggestions: ["Quiz me on…", "Plan my week", "Show my weak topics"],
  },
};

export function AiAssistantScreen({ role }: { role: Role }) {
  const cfg = CHAT_CONFIG[role];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const threadId = useRef<string | null>(null);
  const sendingRef = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
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

  const send = useCallback(
    async (textToSend?: string) => {
      const q = (textToSend ?? input).trim();
      if (!q || sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);
      const stamp = Date.now();
      const pendingId = `${stamp}-ai`;
      const history = messages.filter((m) => m.id.indexOf("err") < 0).map((m) => ({ from: m.from, text: m.text }));
      setMessages((prev) => [
        ...prev,
        { id: String(stamp), from: "user", text: q },
        { id: pendingId, from: "ai", text: "Thinking…" },
      ]);
      if (!textToSend) setInput("");

      const res = await aiChatRepository.send({ threadId: threadId.current, message: q, history });
      sendingRef.current = false;
      if (!alive.current) return;
      setSending(false);
      if (res.ok) threadId.current = res.value.threadId;
      const text = res.ok ? res.value.reply : res.error.message;
      const id = res.ok ? pendingId : `${stamp}-err`;
      setMessages((prev) => prev.map((m) => (m.id === pendingId ? { id, from: "ai", text } : m)));
    },
    [input, messages],
  );

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
        <AiChatComposer suggestions={cfg.suggestions} input={input} onChangeInput={setInput} onSend={send} disabled={sending} />
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
