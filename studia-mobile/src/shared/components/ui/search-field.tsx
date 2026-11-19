// search-field.tsx — search input. Debouncing belongs to the caller's hook (300 ms), not here.
import { StyleSheet, TextInput, View } from "react-native";

import { Icon } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { FONT, MIN_TOUCH, RADIUS, SPACE } from "@/shared/constants/tokens";

export function SearchField({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  autoFocus,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <View style={s.box}>
      <Icon name="search-outline" size="md" color={C.muted} />
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(text.slice(0, 120))}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        style={s.input}
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm + 2,
    height: MIN_TOUCH + 4,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.lg - 2,
  },
  input: { flex: 1, color: C.text, fontSize: 14, fontFamily: FONT.regular, paddingVertical: 0 },
});
