// ai-chat-composer.tsx — suggestion chips + the message input row for the AI assistant screen.
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Icon } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { FONT, RADIUS, SPACE } from "@/shared/constants/tokens";

export function AiChatComposer({
  suggestions,
  input,
  onChangeInput,
  onSend,
  disabled = false,
}: {
  suggestions: readonly string[];
  input: string;
  onChangeInput: (text: string) => void;
  onSend: (textToSend?: string) => void;
  /** True while a reply is on its way: blocks a second send. */
  disabled?: boolean;
}) {
  // Chips would eat the little room the keyboard leaves, so they hide while typing.
  const [focused, setFocused] = useState(false);
  const showChips = !focused && !input;

  return (
    <View style={s.area}>
      {showChips ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.sugRow}
        keyboardShouldPersistTaps="handled"
        style={s.sugScroll}
      >
        {suggestions.map((sug) => (
          <Pressable
            key={sug}
            onPress={() => !disabled && onSend(sug)}
            style={s.sugChip}
            accessibilityRole="button"
            accessibilityLabel={sug}
          >
            <Text style={s.sugText} numberOfLines={1}>
              {sug}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      ) : null}

      <View style={s.inputRow}>
        <View style={s.inputBox}>
          <TextInput
            value={input}
            onChangeText={onChangeInput}
            placeholder="Message STUDIA AI..."
            placeholderTextColor={C.muted}
            style={s.input}
            multiline
            textAlignVertical="center"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            accessibilityLabel="Message STUDIA AI"
          />
        </View>
        <Pressable
          onPress={() => !disabled && onSend()}
          disabled={disabled}
          style={[s.sendBtn, (!input.trim() || disabled) && { backgroundColor: C.lavender }]}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          <Icon name="send" size="md" color={input.trim() ? C.white : C.primaryDark} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  area: { gap: SPACE.sm, paddingTop: SPACE.xs + 2 },
  sugScroll: { flexGrow: 0 },
  sugRow: { gap: SPACE.sm, paddingHorizontal: SPACE.xs, paddingRight: SPACE.lg },
  sugChip: {
    backgroundColor: C.lavenderSoft,
    paddingHorizontal: SPACE.md,
    paddingVertical: 7,
    borderRadius: RADIUS.xl,
  },
  sugText: { color: C.primaryDark, fontSize: 12, fontFamily: FONT.semibold },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: SPACE.sm },
  inputBox: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: RADIUS.xxl,
    paddingHorizontal: SPACE.lg,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
  },
  input: {
    fontSize: 14,
    color: C.text,
    fontFamily: FONT.regular,
    paddingVertical: SPACE.sm,
    minHeight: 28,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
