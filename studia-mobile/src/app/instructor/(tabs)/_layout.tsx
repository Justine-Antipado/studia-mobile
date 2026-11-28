// app/instructor/(tabs)/_layout.tsx — the four bottom tabs only.
// Sub pages (class-detail, grading, ...) are NOT here: they live one level up in the instructor
// Stack and slide in over the tabs. The (tabs) group adds no URL segment, so /instructor/home,
// /instructor/classes ... are unchanged.
// Account and Alerts live in the header (app-header.tsx) instead of the tab bar.
import { Tabs } from "expo-router";

import { TAB_SCREEN } from "@/core/config/transitions";
import { StudiaTabBar, type TabItem } from "@/shared/components/ui/studia-tab-bar";

const TABS: Record<string, TabItem> = {
  home: { label: "Home", icon: "home-outline", activeIcon: "home" },
  classes: { label: "Classes", icon: "people-outline", activeIcon: "people" },
  assessments: { label: "Assess", icon: "clipboard-outline", activeIcon: "clipboard" },
  ai: { label: "AI", icon: "sparkles-outline", activeIcon: "sparkles" },
};

export default function InstructorTabsLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={TAB_SCREEN}
      tabBar={(props) => <StudiaTabBar {...props} items={TABS} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="classes" />
      <Tabs.Screen name="assessments" />
      <Tabs.Screen name="ai" />
    </Tabs>
  );
}
