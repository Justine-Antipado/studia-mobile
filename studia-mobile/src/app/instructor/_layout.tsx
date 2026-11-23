// app/instructor/_layout.tsx — instructor group.
// A Stack with the tab bar group as its base screen; every sub page is pushed on top of it.
// Why not one Tabs navigator with href: null children: navigating to those hidden routes fell
// back to the first tab (the URL flashed /instructor/grading, then snapped back to /home).
// Expo's recommended pattern is tabs nested in an outer stack, which also gives a real back stack.
//
//   instructor/_layout.tsx        <- this Stack
//   instructor/(tabs)/_layout.tsx <- Tabs: home, classes, assessments, ai, notifications, account
//   instructor/class-detail.tsx, grading.tsx, ...  <- sub pages (Stack screens)
//
// The (tabs) group adds no URL segment, so every existing router.push("/instructor/...") still
// works. Transitions come from core/config/transitions.ts and are routed through
// useScreenAnimation so the OS "reduce motion" setting turns them off (docs/ROUTE-MAP.md).
import { Stack } from "expo-router";

import { MODAL_SHEET, STACK_SUBPAGE, useScreenAnimation } from "@/core/config/transitions";
import { ErrorBoundary } from "@/shared/components/ui/error-boundary";
import { RoleGate } from "@/shared/components/ui/role-gate";
import { singularScreenId } from "@/core/logic/screen-id";

/** Create / upload / synthesize flows come up from the bottom; everything else slides in. */
const MODAL_ROUTES = [
  "create-class",
  "post-announcement",
  "upload-material",
  "create-assignment",
  "edit-assignment",
  "create-quiz",
  "edit-quiz",
  "ai-quiz",
] as const;

const SUBPAGE_ROUTES = [
  "account-personal",
  "account-password",
  "account-privacy",
  "account-about",
  "account-photo",
  "analytics",
  "class-detail",
  "announcement-detail",
  "material-detail",
  "assignment-detail",
  "student-detail",
  "quiz-detail",
  "grading",
  "grade-submission",
  "grade-assignment",
  "gradebook",
  "file-viewer",
] as const;

export default function InstructorLayout() {
  const subpage = useScreenAnimation(STACK_SUBPAGE);
  const modal = useScreenAnimation(MODAL_SHEET);
  const tabs = useScreenAnimation({ animation: "none" } as const);

  return (
    <RoleGate role="instructor">
      <ErrorBoundary scope="instructor-group">
        <Stack screenOptions={subpage}>
          <Stack.Screen name="(tabs)" options={tabs} />
          {SUBPAGE_ROUTES.map((name) => (
            <Stack.Screen key={name} name={name} options={subpage} dangerouslySingular={singularScreenId} />
          ))}
          {MODAL_ROUTES.map((name) => (
            <Stack.Screen key={name} name={name} options={modal} dangerouslySingular={singularScreenId} />
          ))}
        </Stack>
        {/* Per-feature maintenance is rendered by Screen inside the content area (B3), so it
            no longer covers the header and the tab bar. */}
      </ErrorBoundary>
    </RoleGate>
  );
}
