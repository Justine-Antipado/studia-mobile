// icon.tsx — the ONE place icons come from, so names stay typed and the set stays small.
// Only Ionicons is imported app-wide; do not import other @expo/vector-icons families.
import { Ionicons } from "@expo/vector-icons";
import { memo, type ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import { C } from "@/shared/constants/studia-colors";
import { RADIUS } from "@/shared/constants/tokens";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export const ICON_SIZE = { xs: 11, sm: 14, md: 18, lg: 22, xl: 28 } as const;
export type IconSize = keyof typeof ICON_SIZE | number;

const px = (size: IconSize) => (typeof size === "number" ? size : ICON_SIZE[size]);

export const Icon = memo(function Icon({
  name,
  size = "md",
  color = C.primary,
}: {
  name: IconName;
  size?: IconSize;
  color?: string;
}) {
  return <Ionicons name={name} size={px(size)} color={color} />;
});

/** Rounded tinted square behind an icon (list leading slot, quick actions, empty states). */
export const IconTile = memo(function IconTile({
  name,
  size = 46,
  bg = C.lavenderSoft,
  color = C.primary,
}: {
  name: IconName;
  size?: number;
  bg?: string;
  color?: string;
}) {
  return (
    <View style={[s.tile, { width: size, height: size, backgroundColor: bg }]}>
      <Ionicons name={name} size={Math.round(size * 0.46)} color={color} />
    </View>
  );
});

const s = StyleSheet.create({
  tile: { borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
});
