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
  const wrapRef = useRef<ComponentRef<typeof View>>(null);
  const [kbPad, setKbPad] = useState(0);
  const kbTop = useRef<number | null>(null); // screenY of the keyboard's top edge, null when closed

  // How much of the wrapper the open keyboard actually covers.
  const recalc = () => {
    const top = kbTop.current;
    if (top == null) {
      setKbPad(0);
      return;
    }
    wrapRef.current?.measureInWindow((_x, y, _w, h) => {
      setKbPad(Math.max(0, Math.round(y + h - top)));
    });
  };

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const showEvt = ios ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvt = ios ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvt, (e) => {
      kbTop.current = e.endCoordinates.screenY;
      recalc();
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      kbTop.current = null;
      setKbPad(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
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
      <View ref={wrapRef} collapsable={false} onLayout={recalc} style={[s.flex, { paddingBottom: kbPad }]}>
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
