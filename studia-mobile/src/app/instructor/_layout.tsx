// // _layout.tsx
// import { Tabs } from "expo-router";
// import { StudiaTabBar, type TabItem } from "@/shared/components/ui/studia-tab-bar";

// const TABS: Record<string, TabItem> = {
//   home: { label: "Home", icon: "home-outline", activeIcon: "home" },
//   classes: {
//     label: "Classes",
//     icon: "people-outline",
//     activeIcon: "people",
//     also: ["class-detail"],
//   },
//   assessments: {
//     label: "Assess",
//     icon: "clipboard-outline",
//     activeIcon: "clipboard",
//   },
//   ai: { label: "AI", icon: "sparkles-outline", activeIcon: "sparkles" },
//   notifications: {
//     label: "Alerts",
//     icon: "notifications-outline",
//     activeIcon: "notifications",
//     badge: 2,
//   },
//   account: { label: "Account", icon: "person-outline", activeIcon: "person" },
// };

// export default function InstructorLayout() {
//   return (
//     <Tabs
//       screenOptions={{ headerShown: false }}
//       tabBar={(props: any) => <StudiaTabBar {...props} items={TABS} />}
//     >
//       <Tabs.Screen name="home" />
//       <Tabs.Screen name="classes" />
//       <Tabs.Screen name="assessments" />
//       <Tabs.Screen name="ai" />
//       <Tabs.Screen name="notifications" />
//       <Tabs.Screen name="account" />
//       <Tabs.Screen name="class-detail" options={{ href: null }} />
//     </Tabs>
//   );
// }
// _layout.tsx
import { Stack } from "expo-router";
import { View } from "react-native";

import { InstructorTabBar } from "@/features/instructor/components/instructor-tab-bar";

export default function InstructorLayout() {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: "none" }} />
      </View>
      <InstructorTabBar />
    </View>
  );
}