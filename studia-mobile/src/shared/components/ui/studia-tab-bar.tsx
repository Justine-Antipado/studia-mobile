// studia-tab-bar.tsx

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { IconName } from "@/shared/components/ui/parts";
import { C } from "@/shared/constants/studia-colors";

export type TabItem = {
  label: string;
  icon: IconName;
  /** icon when the tab is active (optional) */
  activeIcon?: IconName;
  /** detail screens that should keep this tab highlighted */
  also?: string[];
  /** small red dot / count */
  badge?: number;
};

export type StudiaTabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  items: Record<string, TabItem>;
  navigation?: {
    emit: (event: any) => { defaultPrevented?: boolean };
    navigate: (name: string) => void;
  };
  emitter?: { emit: (event: any) => { defaultPrevented?: boolean } };
  navigateToTab?: (routeKey: string) => void;
  [key: string]: any;
};

export function StudiaTabBar({
  state,
  navigation,
  emitter,
  navigateToTab,
  items,
}: StudiaTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [kbOpen, setKbOpen] = useState(false);

  // Hide the bar while typing so the chat input is never covered.
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKbOpen(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKbOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const activeName = state.routes[state.index]?.name;
  const visible = state.routes.filter((r) => items[r.name]);
  const count = Math.max(visible.length, 1);

  // Scale icon/label by how much room each tab gets (works on small phones and tablets).
  const slot = width / count;
  const iconSize = slot < 62 ? 20 : slot < 80 ? 22 : 24;
  const labelSize = slot < 62 ? 9.5 : slot < 80 ? 10 : 10.5;

  if (kbOpen) return null;

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {visible.map((route) => {
        const item = items[route.name]!;
        const focused =
          activeName === route.name || !!item.also?.includes(activeName ?? "");

        const onPress = () => {
          const eventEmitter = emitter ?? navigation;
          const e = eventEmitter?.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (activeName !== route.name && !e?.defaultPrevented) {
            if (navigateToTab) navigateToTab(route.key);
            else navigation?.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: focused }}
            style={s.item}
          >
            <View>
              <Ionicons
                name={focused && item.activeIcon ? item.activeIcon : item.icon}
                size={iconSize}
                color={focused ? C.primary : C.muted}
              />
              {item.badge ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>
                    {item.badge > 9 ? "9+" : item.badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[s.label, { fontSize: labelSize }, focused && s.labelOn]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {item.label}
            </Text>
            <View style={[s.dot, focused && s.dotOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: C.white,
    paddingTop: 8,
    paddingHorizontal: 2,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: C.primaryDark,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 2,
  },
  label: { color: C.muted, fontFamily: "Poppins_400Regular", maxWidth: "100%" },
  labelOn: { color: C.primary, fontFamily: "Poppins_600SemiBold" },
  dot: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: "transparent",
  },
  dotOn: { backgroundColor: C.primary },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: C.white,
    fontSize: 9,
    lineHeight: 12,
    fontFamily: "Poppins_700Bold",
  },
});
