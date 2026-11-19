// transitions.ts — one source of truth for navigation animation.
//   sub-page  -> slide_from_right
//   tab switch-> fade (handled by the Tabs navigator)
//   create/upload sheet -> modal, slide_from_bottom
// Reduce-motion is respected through useScreenAnimation(); durations come from tokens.
import { useReducedMotion } from "react-native-reanimated";

import { C } from "@/shared/constants/studia-colors";
import { DURATION } from "@/shared/constants/tokens";

const CONTENT_STYLE = { backgroundColor: C.surface } as const;

/** Root stack default: welcome/auth flow and the role groups. */
export const STACK_ROOT = {
  headerShown: false,
  animation: "fade",
  animationDuration: DURATION.slow,
  freezeOnBlur: true,
  contentStyle: { backgroundColor: C.lavenderSoft },
} as const;

/** Detail screens inside a role group (course-detail, grading, viewer...). */
export const STACK_SUBPAGE = {
  headerShown: false,
  animation: "slide_from_right",
  animationDuration: DURATION.base,
  contentStyle: CONTENT_STYLE,
} as const;

/** Create / upload / take-quiz flows: come up from the bottom, dismissable. */
export const MODAL_SHEET = {
  headerShown: false,
  presentation: "modal",
  animation: "slide_from_bottom",
  animationDuration: DURATION.base,
  contentStyle: CONTENT_STYLE,
} as const;

/** Tab screens: no slide, keep them mounted so switching never refetches or rebuilds. */
export const TAB_SCREEN = {
  headerShown: false,
  animation: "fade",
  freezeOnBlur: true,
  lazy: true,
} as const;

/** Instant variant used when the OS reduce-motion setting is on. */
export const NO_ANIMATION = { animation: "none", animationDuration: 0 } as const;

/**
 * Spread over a Stack.Screen / Tabs.Screen options object:
 *   <Stack.Screen name="x" options={useScreenAnimation(STACK_SUBPAGE)} />
 */
export function useScreenAnimation<T extends object>(options: T): T {
  const reduced = useReducedMotion();
  return reduced ? { ...options, ...NO_ANIMATION } : options;
}
