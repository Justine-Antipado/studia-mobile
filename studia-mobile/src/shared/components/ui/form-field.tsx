// form-field.tsx — labelled text input with helper + error text. Used by every form.
// Validation itself lives in each feature's logic/ folder, never inside this component.
import { forwardRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextInputInstance,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Icon, type IconName } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { FONT, MIN_TOUCH, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";

export type FormFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  helper?: string;
  icon?: IconName;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export const FormField = forwardRef<TextInputInstance, FormFieldProps>(function FormField(
  { label, error, helper, icon, required, containerStyle, multiline, style, ...rest },
  ref,
) {
  return (
    <View style={[s.wrap, containerStyle]}>
      <Text style={TYPE.label} numberOfLines={1}>
        {label}
        {required ? <Text style={s.required}> *</Text> : null}
      </Text>

      <View style={[s.box, multiline && s.boxMultiline, !!error && s.boxError]}>
        {icon ? <Icon name={icon} size="md" color={C.muted} /> : null}
        <TextInput
          ref={ref}
          style={[s.input, multiline && s.inputMultiline, style]}
          placeholderTextColor={C.muted}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          accessibilityLabel={label}
          accessibilityHint={helper}
          {...rest}
        />
      </View>

      {error ? (
        <Text style={s.error} numberOfLines={2}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={TYPE.caption} numberOfLines={2}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { gap: 6 },
  required: { color: C.red },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm + 2,
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: SPACE.lg - 2,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.lg,
  },
  boxMultiline: { minHeight: 110, alignItems: "flex-start", paddingVertical: SPACE.md },
  boxError: { borderColor: C.red },
  input: {
    flex: 1,
    paddingVertical: SPACE.sm + 2,
    color: C.text,
    fontSize: 14,
    fontFamily: FONT.regular,
  },
  inputMultiline: { minHeight: 86 },
  error: { color: C.red, fontSize: 11.5, lineHeight: 16, fontFamily: FONT.semibold },
});
