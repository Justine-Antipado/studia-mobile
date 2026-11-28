// app/student/(tabs)/_layout.tsx — the four bottom tabs only.
// Sub pages (course-detail, lesson-viewer, quiz-take, ...) are NOT here: they live one level up in
// the student Stack and slide in over the tabs. The (tabs) group adds no URL segment, so
// /student/home, /student/courses ... are unchanged.
// Account and Alerts live in the header (app-header.tsx) instead of the tab bar.
import { Tabs } from "expo-router";

import { TAB_SCREEN } from "@/core/config/transitions";
import { StudiaTabBar, type TabItem } from "@/shared/components/ui/studia-tab-bar";

const TABS: Record<string, TabItem> = {
  home: { label: "Home", icon: "home-outline", activeIcon: "home" },
  courses: { label: "Courses", icon: "book-outline", activeIcon: "book" },
  todo: { label: "To-do", icon: "checkbox-outline", activeIcon: "checkbox" },
  planner: { label: "Planner", icon: "calendar-outline", activeIcon: "calendar" },
  ai: { label: "AI", icon: "sparkles-outline", activeIcon: "sparkles" },
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
      <Tabs.Screen name="todo" />
      <Tabs.Screen name="planner" />
      <Tabs.Screen name="ai" />
    </Tabs>
  );
}
