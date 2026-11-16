// import { Tabs } from "expo-router";
// import { StudiaTabBar, type TabItem } from "@/components/ui/studia-tab-bar";

// const TABS: Record<string, TabItem> = {
//   home: { label: "Home", icon: "home-outline" },
//   classes: { label: "Classes", icon: "people-outline", also: ["class-detail"] },
//   assessments: { label: "Assessments", icon: "clipboard-outline" },
//   ai: { label: "AI Assistant", icon: "sparkles-outline" },
//   account: { label: "Account", icon: "person-outline" },
// };

// export default function InstructorLayout() {
//   return (
//     <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <StudiaTabBar {...props} items={TABS} />}>
//       <Tabs.Screen name="home" />
//       <Tabs.Screen name="classes" />
//       <Tabs.Screen name="assessments" />
//       <Tabs.Screen name="ai" />
//       <Tabs.Screen name="account" />
//       <Tabs.Screen name="class-detail" options={{ href: null }} />
//     </Tabs>
//   );
// }
// src/app/instructor/_layout.tsx
import { Tabs } from "expo-router";
import { StudiaTabBar, type TabItem } from "@/components/ui/studia-tab-bar";

const TABS: Record<string, TabItem> = {
  home: { label: "Home", icon: "home-outline" },
  classes: { label: "Classes", icon: "people-outline", also: ["class-detail"] },
  assessments: { label: "Assessments", icon: "clipboard-outline" },
  ai: { label: "AI Assistant", icon: "sparkles-outline" },
  account: { label: "Account", icon: "person-outline" },
};

export default function InstructorLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props: any) => <StudiaTabBar {...props} items={TABS} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="classes" />
      <Tabs.Screen name="assessments" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="account" />
      <Tabs.Screen name="class-detail" options={{ href: null }} />
    </Tabs>
  );
}