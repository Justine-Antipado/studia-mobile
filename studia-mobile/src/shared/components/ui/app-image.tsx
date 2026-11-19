// app-image.tsx — the ONLY component allowed to use expo-image / render remote images.
// Screens never import expo-image or RN Image directly (cache policy + placeholder must stay uniform).
import { Image, type ImageContentFit, type ImageSource } from "expo-image";
import { memo } from "react";
import { StyleSheet, type StyleProp, type ImageStyle } from "react-native";

import { C } from "@/shared/constants/studia-colors";
import { DURATION, RADIUS } from "@/shared/constants/tokens";

type Props = {
  source: ImageSource | string | number | null | undefined;
  /** Fixed shape without layout jumps: give aspectRatio (or a style with width/height). */
  aspectRatio?: number;
  contentFit?: ImageContentFit;
  /** Solid color or blurhash shown while loading. */
  placeholder?: string;
  /** Stable id of the item in a list — lets expo-image recycle views correctly. */
  recyclingKey?: string;
  radius?: number;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
};

export const AppImage = memo(function AppImage({
  source,
  aspectRatio,
  contentFit = "cover",
  placeholder = C.lavenderSoft,
  recyclingKey,
  radius = RADIUS.lg,
  style,
  accessibilityLabel,
}: Props) {
  return (
    <Image
      source={source ?? undefined}
      style={[s.base, { borderRadius: radius }, aspectRatio ? { aspectRatio } : null, style]}
      contentFit={contentFit}
      placeholder={placeholder}
      placeholderContentFit="cover"
      transition={{ duration: DURATION.base, effect: "cross-dissolve" }}
      cachePolicy="memory-disk"
      recyclingKey={recyclingKey}
      alt={accessibilityLabel}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    />
  );
});

/** Warm the disk cache for images the next screen will show (e.g. class covers). */
export function prefetchImages(urls: readonly string[]): void {
  const remote = urls.filter((u) => /^https?:\/\//.test(u));
  if (remote.length) void Image.prefetch(remote, { cachePolicy: "memory-disk" });
}

/** Called on logout / user switch, together with the query + file caches. */
export async function clearImageCache(): Promise<void> {
  await Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()]);
}

const s = StyleSheet.create({ base: { backgroundColor: C.lavenderSoft, overflow: "hidden" } });
