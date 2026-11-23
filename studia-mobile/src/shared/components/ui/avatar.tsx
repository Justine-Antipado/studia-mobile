// avatar.tsx — initials by default, photo through AppImage when a URI exists.
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAvatarSource } from "@/core/data/avatars";
import { AppImage } from "@/shared/components/ui/app-image";
import { initials } from "@/core/data/storage/session-store";
import { C } from "@/shared/constants/studia-colors";
import { FONT } from "@/shared/constants/tokens";

export const Avatar = memo(function Avatar({
  name,
  uri,
  userId,
  size = 44,
  max = 2,
}: {
  name: string;
  /** A photo you already have (your own, on your device). */
  uri?: string | null;
  /** Someone else's id: their photo is fetched and cached (core/data/avatars.ts). Initials until it loads. */
  userId?: string | null;
  size?: number;
  max?: number;
}) {
  const shape = { width: size, height: size, borderRadius: size / 2 };
  const remote = useAvatarSource(uri ? null : userId);

  if (uri || remote) {
    return (
      <AppImage
        source={uri ?? remote}
        radius={size / 2}
        recyclingKey={uri ?? remote?.cacheKey}
        style={shape}
        accessibilityLabel={name}
      />
    );
  }

  return (
    <View style={[s.fallback, shape]} accessible accessibilityLabel={name}>
      <Text style={[s.text, { fontSize: size * 0.34 }]}>{initials(name, max)}</Text>
    </View>
  );
});

const s = StyleSheet.create({
  fallback: { backgroundColor: C.lavender, alignItems: "center", justifyContent: "center" },
  text: { color: C.primaryDark, fontFamily: FONT.bold },
});
