// app/student/_layout.tsx — student group.
// A Stack with the tab bar group as its base screen; every sub page is pushed on top of it.
// Why not one Tabs navigator with href: null children: navigating to those hidden routes fell
// back to the first tab (the URL flashed the sub page, then snapped back to /home).
// Expo's recommended pattern is tabs nested in an outer stack, which also gives a real back stack.
//
//   student/_layout.tsx        <- this Stack
//   student/(tabs)/_layout.tsx <- Tabs: home, courses, ai, notifications, account
//   student/course-detail.tsx, lesson-viewer.tsx, ...  <- sub pages (Stack screens)
//
// The (tabs) group adds no URL segment, so every existing router.push("/student/...") still works.
// Transitions come from core/config/transitions.ts and are routed through useScreenAnimation so
// the OS "reduce motion" setting turns them off (docs/ROUTE-MAP.md).
import { Stack } from "expo-router";

import { MODAL_SHEET, STACK_SUBPAGE, useScreenAnimation } from "@/core/config/transitions";
import { ErrorBoundary } from "@/shared/components/ui/error-boundary";
import { RoleGate } from "@/shared/components/ui/role-gate";
import { screenId } from "@/core/logic/screen-id";

/** Create / join / take-quiz flows come up from the bottom; everything else slides in. */
const MODAL_ROUTES = ["join-class", "search", "quiz-take"] as const;

const SUBPAGE_ROUTES = [
  "account-personal",
  "account-password",
  "account-privacy",
  "account-about",
  "account-photo",
  "todo",
  "planner",
  "course-detail",
  "announcement-detail",
  "lesson-viewer",
  "assignment-detail",
  "quiz-result",
] as const;

export default function StudentLayout() {
  const subpage = useScreenAnimation(STACK_SUBPAGE);
  const modal = useScreenAnimation(MODAL_SHEET);
  const tabs = useScreenAnimation({ animation: "none" } as const);

  return (
    <RoleGate role="student">
      <ErrorBoundary scope="student-group">
        <Stack screenOptions={subpage}>
          <Stack.Screen name="(tabs)" options={tabs} />
          {SUBPAGE_ROUTES.map((name) => (
            <Stack.Screen key={name} name={name} options={subpage} getId={screenId} />
          ))}
          {MODAL_ROUTES.map((name) => (
            <Stack.Screen key={name} name={name} options={modal} getId={screenId} />
          ))}
        </Stack>
      </ErrorBoundary>
    </RoleGate>
  );
}
