// offline-banner.tsx — shown at the top of a screen while the device has no connection.
// Reads cached data still renders underneath; writes should be disabled by the caller.
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/shared/components/ui/icon";
import { C, TONES } from "@/shared/constants/studia-colors";
import { RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";
import { useNetwork } from "@/shared/hooks/use-network";

export function OfflineBanner() {
  const { isOnline } = useNetwork();
  if (isOnline) return null;

  return (
    <View style={s.wrap} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon name="cloud-offline-outline" size="sm" color={C.orange} />
      <Text style={[TYPE.label, s.text]} numberOfLines={2}>
        You are offline. Showing saved data; some actions are disabled.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    backgroundColor: TONES.orange.bg,
    borderWidth: 1,
    borderColor: TONES.orange.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.md + 2,
    paddingVertical: SPACE.sm + 2,
  },
  text: { flex: 1, color: TONES.orange.strong },
});
