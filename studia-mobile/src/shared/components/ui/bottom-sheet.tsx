// bottom-sheet.tsx — slide-up panel for pickers and short forms that are NOT their own route.
// Full create/upload flows are modal ROUTES (see core/config/transitions.ts), not sheets.
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/shared/components/ui/icon";
import { C, OVERLAY } from "@/shared/constants/studia-colors";
import { HIT_SLOP, MIN_TOUCH, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";

export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  scroll = true,
  height,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  scroll?: boolean;
  /** Fixed sheet height (dp). Without it the sheet fits its content up to 85% of the screen. */
  height?: number;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} accessibilityLabel="Close" onPress={onClose} />
      <KeyboardAvoidingView
        behavior="padding"
        style={s.anchor}
      >
        <View style={[s.sheet, height ? { height } : null, { paddingBottom: Math.max(insets.bottom, SPACE.lg) }]}>
          <View style={s.grabber} />
          <View style={s.head}>
            <Text style={[TYPE.h2, s.title]} numberOfLines={1}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={s.close}
            >
              <Icon name="close" size="lg" color={C.primaryDark} />
            </Pressable>
          </View>

          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.body}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[s.body, height ? s.bodyFixed : null]}>{children}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: OVERLAY.scrim },
  anchor: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "85%",
    backgroundColor: C.white,
    borderTopLeftRadius: RADIUS.xxl + 6,
    borderTopRightRadius: RADIUS.xxl + 6,
    paddingHorizontal: SPACE.xl - 6,
    paddingTop: SPACE.md,
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.lavender,
    marginBottom: SPACE.md,
  },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  title: { flex: 1 },
  close: {
    width: MIN_TOUCH - 8,
    height: MIN_TOUCH - 8,
    borderRadius: RADIUS.pill,
    backgroundColor: C.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { gap: SPACE.md + 2, paddingTop: SPACE.lg, paddingBottom: SPACE.sm },
  bodyFixed: { flex: 1 },
});
