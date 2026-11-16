// // components/ui/studia-tab-bar.tsx
// // If the import below fails: npx expo install @react-navigation/bottom-tabs
// import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
// import { Ionicons } from "@expo/vector-icons";
// import { Pressable, StyleSheet, Text, View } from "react-native";
// import { useSafeAreaInsets } from "react-native-safe-area-context";

// import type { IconName } from "@/components/ui/parts";
// import { C } from "@/constants/studia-colors";

// export type TabItem = { label: string; icon: IconName; /** detail screens that should keep this tab highlighted */ also?: string[] };

// export function StudiaTabBar({ state, navigation, items }: BottomTabBarProps & { items: Record<string, TabItem> }) {
//   const insets = useSafeAreaInsets();
//   const activeName = state.routes[state.index]?.name;

//   return (
//     <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
//       {state.routes
//         .filter((r) => items[r.name])
//         .map((route) => {
//           const item = items[route.name]!;
//           const focused = activeName === route.name || !!item.also?.includes(activeName ?? "");
//           const onPress = () => {
//             const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
//             // Also lets you go from a detail screen back to its list by tapping the tab.
//             if (activeName !== route.name && !e.defaultPrevented) navigation.navigate(route.name);
//           };
//           return (
//             <Pressable
//               key={route.key}
//               onPress={onPress}
//               accessibilityRole="tab"
//               accessibilityLabel={item.label}
//               accessibilityState={{ selected: focused }}
//               style={s.item}
//             >
//               <Ionicons name={item.icon} size={24} color={focused ? C.primary : C.muted} />
//               <Text style={[s.label, focused && s.labelOn]} numberOfLines={1}>
//                 {item.label}
//               </Text>
//               <View style={[s.dot, focused && s.dotOn]} />
//             </Pressable>
//           );
//         })}
//     </View>
//   );
// }

// const s = StyleSheet.create({
//   bar: {
//     flexDirection: "row",
//     backgroundColor: C.white,
//     paddingTop: 10,
//     borderTopLeftRadius: 24,
//     borderTopRightRadius: 24,
//     shadowColor: C.primaryDark,
//     shadowOpacity: 0.1,
//     shadowRadius: 12,
//     shadowOffset: { width: 0, height: -3 },
//     elevation: 12,
//   },
//   item: { flex: 1, alignItems: "center", gap: 3 },
//   label: { color: C.muted, fontSize: 10.5, fontFamily: "Poppins_400Regular" },
//   labelOn: { color: C.primary, fontFamily: "Poppins_600SemiBold" },
//   dot: { width: 18, height: 3, borderRadius: 2, backgroundColor: "transparent" },
//   dotOn: { backgroundColor: C.primary },
// });
// components/ui/studia-tab-bar.tsx
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { IconName } from "@/components/ui/parts";
import { C } from "@/constants/studia-colors";

export type TabItem = {
  label: string;
  icon: IconName;
  /** detail screens that should keep this tab highlighted */
  also?: string[];
};

export type StudiaTabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  items: Record<string, TabItem>;
  // Para sa mas lumang @react-navigation/bottom-tabs
  navigation?: {
    emit: (event: any) => { defaultPrevented?: boolean };
    navigate: (name: string) => void;
  };
  // Para sa bagong @react-navigation/bottom-tabs (Expo SDK 52+)
  emitter?: {
    emit: (event: any) => { defaultPrevented?: boolean };
  };
  navigateToTab?: (routeKey: string) => void;
  [key: string]: any;
};

export function StudiaTabBar({ state, navigation, emitter, navigateToTab, items }: StudiaTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes
        .filter((r) => items[r.name])
        .map((route) => {
          const item = items[route.name]!;
          const focused = activeName === route.name || !!item.also?.includes(activeName ?? "");

          const onPress = () => {
            const eventEmitter = emitter ?? navigation;
            const e = eventEmitter?.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (activeName !== route.name && !e?.defaultPrevented) {
              if (navigateToTab) {
                navigateToTab(route.key);
              } else {
                navigation?.navigate(route.name);
              }
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
              <Ionicons name={item.icon} size={24} color={focused ? C.primary : C.muted} />
              <Text style={[s.label, focused && s.labelOn]} numberOfLines={1}>
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
    paddingTop: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: C.primaryDark,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  item: { flex: 1, alignItems: "center", gap: 3 },
  label: { color: C.muted, fontSize: 10.5, fontFamily: "Poppins_400Regular" },
  labelOn: { color: C.primary, fontFamily: "Poppins_600SemiBold" },
  dot: { width: 18, height: 3, borderRadius: 2, backgroundColor: "transparent" },
  dotOn: { backgroundColor: C.primary },
});