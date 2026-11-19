// app/student/(tabs)/_layout.tsx — the five bottom tabs only.
// Sub pages (course-detail, lesson-viewer, quiz-take, ...) are NOT here: they live one level up in
// the student Stack and slide in over the tabs. The (tabs) group adds no URL segment, so
// /student/home, /student/courses ... are unchanged.
import { Tabs } from "expo-router";

import { TAB_SCREEN } from "@/core/config/transitions";
import { StudiaTabBar, type TabItem } from "@/shared/components/ui/studia-tab-bar";

const TABS: Record<string, TabItem> = {
  home: { label: "Home", icon: "home-outline", activeIcon: "home" },
  courses: { label: "Courses", icon: "book-outline", activeIcon: "book" },
  ai: { label: "AI", icon: "sparkles-outline", activeIcon: "sparkles" },
  notifications: {
    label: "Alerts",
    icon: "notifications-outline",
    activeIcon: "notifications",
    badge: 2,
  },
  account: { label: "Account", icon: "person-outline", activeIcon: "person" },
};

export default function StudentTabsLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={TAB_SCREEN}
      tabBar={(props) => <StudiaTabBar {...props} items={TABS} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="courses" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
