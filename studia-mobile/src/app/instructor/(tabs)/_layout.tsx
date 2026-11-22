// app/instructor/(tabs)/_layout.tsx — the six bottom tabs only.
// Sub pages (class-detail, grading, ...) are NOT here: they live one level up in the instructor
// Stack and slide in over the tabs. The (tabs) group adds no URL segment, so /instructor/home,
// /instructor/classes ... are unchanged.
import { Tabs } from "expo-router";
import { useMemo } from "react";

import { TAB_SCREEN } from "@/core/config/transitions";
import { useNotifications } from "@/features/shared-screens/hooks/use-notifications";
import { StudiaTabBar, type TabItem } from "@/shared/components/ui/studia-tab-bar";

const TABS: Record<string, TabItem> = {
  home: { label: "Home", icon: "home-outline", activeIcon: "home" },
  classes: { label: "Classes", icon: "people-outline", activeIcon: "people" },
  assessments: { label: "Assess", icon: "clipboard-outline", activeIcon: "clipboard" },
  ai: { label: "AI", icon: "sparkles-outline", activeIcon: "sparkles" },
  notifications: {
    label: "Alerts",
    icon: "notifications-outline",
    activeIcon: "notifications",
  },
  account: { label: "Account", icon: "person-outline", activeIcon: "person" },
};

export default function InstructorTabsLayout() {
  // Real unread count (was a hard-coded 2).
  const feed = useNotifications("instructor");
  const unread = useMemo(() => (feed.data ?? []).filter((n) => n.unread).length, [feed.data]);
  const items = useMemo(
    () => ({ ...TABS, notifications: { ...TABS.notifications, badge: unread || undefined } }),
    [unread],
  );
  return (
    <Tabs
      backBehavior="history"
      screenOptions={TAB_SCREEN}
      tabBar={(props) => <StudiaTabBar {...props} items={items} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="classes" />
      <Tabs.Screen name="assessments" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
