// components/ui/app-header.tsx
// Left: OMSC logo | STUDIA logo.  Right: the Alerts bell and the avatar.
// Who is signed in (name + role tag) moved to each role's Home screen instead of living here —
// crammed next to the logos, bell and avatar it made the header feel tight on narrow phones.
// Account and Alerts have no tab of their own (see app/<role>/(tabs)/_layout.tsx) — tapping the
// avatar opens Account, tapping the bell opens Alerts, from whichever screen the header is on.
import { usePathname } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNotifications } from "@/features/shared-screens/hooks/use-notifications";
import { AppImage } from "@/shared/components/ui/app-image";
import { Avatar } from "@/shared/components/ui/avatar";
import { Icon } from "@/shared/components/ui/icon";
import { C, OVERLAY } from "@/shared/constants/studia-colors";
import { FONT, HIT_SLOP, RADIUS, SPACE } from "@/shared/constants/tokens";
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { displayName, type UserProfile } from "@/core/data/storage/session-store";

const OMSC_LOGO = require("@/assets/images/omsc.logo.png");
const STUDIA_LOGO = require("@/assets/images/studia-mobile-logo.png");

export function AppHeader({ user }: { user: UserProfile }) {
  const insets = useSafeAreaInsets();
  const router = useSafeRouter();
  const pathname = usePathname();
  const name = displayName(user);
  const role = user.role === "instructor" ? "instructor" : "student";
  const feed = useNotifications(role);
  const unread = (feed.data ?? []).filter((n) => n.unread).length;

  const alertsPath = `/${role}/notifications`;
  const accountPath = `/${role}/account`;

  // Alerts and Account are reachable from this header on every screen, including from each
  // other. Pushing both ways would stack a new entry per tap, so bouncing between them needlessly
  // buries whatever screen the user actually started from — replace instead of push whenever the
  // one we're leaving is itself Alerts or Account, so only one of them ever sits on the stack.
  const openAlerts = useCallback(() => {
    if (pathname === alertsPath) return;
    if (pathname === accountPath) router.replace(alertsPath);
    else router.push(alertsPath);
  }, [pathname, alertsPath, accountPath, router]);

  const openAccount = useCallback(() => {
    if (pathname === accountPath) return;
    if (pathname === alertsPath) router.replace(accountPath);
    else router.push(accountPath);
  }, [pathname, alertsPath, accountPath, router]);

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

        <View style={s.who}>
          <Pressable
            onPress={openAlerts}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Alerts, ${unread} unread` : "Alerts"}
          >
            <View style={s.bellTile}>
              <Icon name="notifications-outline" size="md" color={C.white} />
              {unread > 0 ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unread > 9 ? "9+" : unread}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>

          <Pressable
            onPress={openAccount}
            accessibilityRole="button"
            accessibilityLabel="Account"
          >
            <Avatar name={name} uri={user.avatarUri} size={36} />
          </Pressable>
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
  bellTile: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: OVERLAY.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: C.white, fontSize: 9.5, lineHeight: 12, fontFamily: FONT.bold },
});