//  instructor-tab-bar.tsx

import { type Href, usePathname, useRouter } from "expo-router";

import { StudiaTabBar, type TabItem } from "@/shared/components/ui/studia-tab-bar";

const TABS: Record<string, TabItem> = {
  home: { label: "Home", icon: "home-outline", activeIcon: "home" },
  classes: { label: "Classes", icon: "people-outline", activeIcon: "people", also: ["class-detail"] },
  assessments: {
    label: "Assess",
    icon: "clipboard-outline",
    activeIcon: "clipboard",
    also: ["grading", "grade-submission", "gradebook", "create-quiz", "ai-quiz"],
  },
  ai: { label: "AI", icon: "sparkles-outline", activeIcon: "sparkles" },
  notifications: { label: "Alerts", icon: "notifications-outline", activeIcon: "notifications", badge: 2 },
  account: { label: "Account", icon: "person-outline", activeIcon: "person" },
};

export function InstructorTabBar() {
  const pathname = usePathname();
  const router = useRouter();

  const current = pathname.split("/").filter(Boolean).pop() ?? "home";
  const routes = Object.keys(TABS).map((name) => ({ key: name, name }));
  if (!TABS[current]) routes.push({ key: current, name: current });
  const index = Math.max(0, routes.findIndex((r) => r.name === current));

  return (
    <StudiaTabBar
      state={{ index, routes }}
      items={TABS}
      navigateToTab={(key) => router.replace(`/instructor/${key}` as Href)}
    />
  );
}