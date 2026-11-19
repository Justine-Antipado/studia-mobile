// empty-state.tsx — empty / error placeholder with the Studia mascot or an icon, plus one action.
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/shared/components/ui/app-button";
import { AppImage } from "@/shared/components/ui/app-image";
import { IconTile, type IconName } from "@/shared/components/ui/icon";
import { SPACE, TYPE } from "@/shared/constants/tokens";

const MASCOT = require("@/assets/images/studia-mascot.png");

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  mascot = false,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Friendlier illustration for first-run empty screens. */
  mascot?: boolean;
}) {
  return (
    <View style={s.box}>
      {mascot ? (
        <AppImage source={MASCOT} contentFit="contain" style={s.mascot} accessibilityLabel="Studia" />
      ) : (
        <IconTile name={icon ?? "file-tray-outline"} size={56} />
      )}
      <Text style={TYPE.h3} numberOfLines={2}>
        {title}
      </Text>
      {message ? (
        <Text style={[TYPE.muted, s.message]} numberOfLines={4}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={s.action}>
          <AppButton label={actionLabel} variant="secondary" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    alignItems: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.xxl + 4,
    paddingHorizontal: SPACE.xl,
  },
  mascot: { width: 96, height: 96, backgroundColor: "transparent" },
  message: { textAlign: "center" },
  action: { marginTop: SPACE.sm, alignSelf: "stretch", maxWidth: 280 },
});
