// _layout.tsx

import { Tabs } from "expo-router";
import { StudiaTabBar, type TabItem } from "@/shared/components/ui/studia-tab-bar";

const TABS: Record<string, TabItem> = {
  home: { label: "Home", icon: "home-outline", activeIcon: "home" },
  courses: {
    label: "Courses",
    icon: "book-outline",
    activeIcon: "book",
    also: ["course-detail"],
  },
  ai: { label: "AI", icon: "sparkles-outline", activeIcon: "sparkles" },
  notifications: {
    label: "Alerts",
    icon: "notifications-outline",
    activeIcon: "notifications",
    badge: 2,
  },
  account: { label: "Account", icon: "person-outline", activeIcon: "person" },
};

export default function StudentLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props: any) => <StudiaTabBar {...props} items={TABS} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="courses" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="account" />
      <Tabs.Screen name="course-detail" options={{ href: null }} />
    </Tabs>
  );
}
