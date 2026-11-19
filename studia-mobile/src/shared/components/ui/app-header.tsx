// components/ui/app-header.tsx
// Left: OMSC logo | STUDIA logo.  Right: who is logged in + role + department (or course/section for students).
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppImage } from "@/shared/components/ui/app-image";
import { Avatar } from "@/shared/components/ui/avatar";
import { Icon } from "@/shared/components/ui/icon";
import { C, OVERLAY } from "@/shared/constants/studia-colors";
import { FONT, RADIUS, SPACE } from "@/shared/constants/tokens";
import { displayName, tagLabel, type UserProfile } from "@/core/data/storage/session-store";

const OMSC_LOGO = require("@/assets/images/omsc.logo.png");
const STUDIA_LOGO = require("@/assets/images/studia-mobile-logo.png");

export function AppHeader({ user }: { user: UserProfile }) {
  const insets = useSafeAreaInsets();
  const name = displayName(user);
  const tag = tagLabel(user);

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 10 }]}>
      <View style={s.blob} />
      <View style={s.row}>
        <View style={s.logos}>
          {/* Bundled assets, so they are available offline and never fetched. */}
          <AppImage source={OMSC_LOGO} style={s.logo} contentFit="contain" accessibilityLabel="OMSC logo" />
          <View style={s.sep} />
          <AppImage source={STUDIA_LOGO} style={s.logo} contentFit="contain" accessibilityLabel="Studia logo" />
        </View>

        <View style={s.who} accessible accessibilityLabel={`Logged in as ${name}, ${tag}`}>
          <View style={s.whoText}>
            <Text style={s.name} numberOfLines={1}>
              {name}
            </Text>
            <View style={s.tag}>
              <Icon name={user.role === "instructor" ? "school" : "person"} size="xs" color={C.lavender} />
              <Text style={s.tagText} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          </View>
          <Avatar name={name} size={36} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: C.primaryDark,
    paddingHorizontal: SPACE.lg + 2,
    paddingBottom: SPACE.md + 2,
    borderBottomLeftRadius: RADIUS.xxl + 6,
    borderBottomRightRadius: RADIUS.xxl + 6,
    // Keeps the decorative blob below from affecting layout or drawing outside the header.
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: C.primary,
    opacity: 0.45,
    top: -90,
    right: -60,
  },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  logos: { flexDirection: "row", alignItems: "center", gap: SPACE.sm + 2 },
  logo: { width: 38, height: 38 },
  sep: { width: 1, height: 26, backgroundColor: OVERLAY.divider },
  who: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: SPACE.sm + 2 },
  whoText: { flexShrink: 1, alignItems: "flex-end", gap: 3 },
  name: { color: C.white, fontSize: 14, lineHeight: 20, fontFamily: FONT.bold, maxWidth: "100%" },
  tag: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    backgroundColor: OVERLAY.soft,
    borderRadius: RADIUS.sm + 2,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
  },
  tagText: { flexShrink: 1, color: C.lavender, fontSize: 10.5, fontFamily: FONT.semibold },
});