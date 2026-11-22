// confirm-dialog.tsx — required before every destructive action (delete class, remove student,
// leave class, logout) and before discarding unsaved form changes.
import { useEffect, useRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/shared/components/ui/app-button";
import { IconTile, type IconName } from "@/shared/components/ui/icon";
import { C, TONES, type Tone } from "@/shared/constants/studia-colors";
import { RADIUS, SHADOW, SPACE, TYPE } from "@/shared/constants/tokens";

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  icon?: IconName;
  tone?: Tone;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Disables both buttons while the action runs (prevents double-submit). */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  icon = "alert-circle-outline",
  tone = "red",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const c = TONES[tone];
  // `busy` arrives via async state, so a fast double tap could fire onConfirm twice before it
  // does. Latch the first press; re-arm whenever the dialog is shown again or busy ends.
  const fired = useRef(false);
  useEffect(() => {
    if (!visible || !busy) fired.current = false;
  }, [visible, busy]);
  const confirmOnce = () => {
    if (fired.current) return;
    fired.current = true;
    setTimeout(() => {
      if (!busy) fired.current = false;
    }, 800);
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={busy ? undefined : onCancel}
    >
      <Pressable
        style={s.backdrop}
        accessibilityLabel={cancelLabel}
        onPress={busy ? undefined : onCancel}
      />
      <View style={s.center} pointerEvents="box-none">
        <View style={s.dialog} accessibilityViewIsModal accessibilityRole="alert">
          <IconTile name={icon} size={52} bg={c.bg} color={c.fg} />
          <Text style={[TYPE.h2, s.text]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[TYPE.muted, s.text]} numberOfLines={5}>
            {message}
          </Text>
          <View style={s.actions}>
            <View style={s.flex}>
              <AppButton label={cancelLabel} variant="secondary" disabled={busy} onPress={onCancel} />
            </View>
            <View style={s.flex}>
              <AppButton label={confirmLabel} disabled={busy} onPress={confirmOnce} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(31,36,56,0.45)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.xl },
  dialog: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: SPACE.sm,
    backgroundColor: C.white,
    borderRadius: RADIUS.xxl,
    padding: SPACE.xl,
    ...SHADOW.raised,
  },
  text: { textAlign: "center" },
  actions: { flexDirection: "row", gap: SPACE.md, alignSelf: "stretch", marginTop: SPACE.md },
  flex: { flex: 1 },
});
