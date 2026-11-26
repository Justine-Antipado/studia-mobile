// transitions.ts — one source of truth for navigation animation.
//   sub-page  -> slide_from_right
//   tab switch-> fade (handled by the Tabs navigator)
//   create/upload sheet -> modal, slide_from_bottom
// Reduce-motion is respected through useScreenAnimation(); durations come from tokens.
import { Platform } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { C } from "@/shared/constants/studia-colors";
import { DURATION } from "@/shared/constants/tokens";

const CONTENT_STYLE = { backgroundColor: C.surface } as const;

/** Root stack default: the welcome / explore / auth flow (purple, full-bleed screens). */
export const STACK_ROOT = {
  headerShown: false,
  animation: "fade",
  // D1: 320 ms of cross-fade is long enough to read as a flicker on Android, where both screens
  // are composited while they overlap. The short fade keeps the polish without the flash.
  animationDuration: DURATION.base,
  freezeOnBlur: true,
  contentStyle: { backgroundColor: C.lavenderSoft },
} as const;

/**
 * The student / instructor groups. Two differences from STACK_ROOT, both D1:
 *   - an opaque SURFACE background, so entering the group cannot flash the lavender of the auth
 *     flow (or the window's black) in the frame before Home paints
 *   - no cross-fade on Android: the group's first screen is a Tabs navigator that mounts during
 *     the animation, and fading a mounting navigator is what made Home flicker. iOS keeps the fade.
 */
export const STACK_ROLE_GROUP = {
  headerShown: false,
  animation: Platform.OS === "android" ? "none" : "fade",
  animationDuration: DURATION.base,
  freezeOnBlur: true,
  contentStyle: CONTENT_STYLE,
} as const;

/** Detail screens inside a role group (course-detail, grading, viewer...). */
export const STACK_SUBPAGE = {
  headerShown: false,
  animation: "slide_from_right",
  animationDuration: DURATION.base,
  contentStyle: CONTENT_STYLE,
} as const;

/**
 * Create / upload / take-quiz flows: come up from the bottom.
 * gestureEnabled is off: the native swipe-to-dismiss gesture calls the navigator's GO_BACK
 * directly, bypassing useSafeBack/useUnsavedGuard, so a dirty form could be swiped away without
 * the discard confirmation. These screens must be left through their own back button.
 */
export const MODAL_SHEET = {
  headerShown: false,
  presentation: "modal",
  animation: "slide_from_bottom",
  animationDuration: DURATION.base,
  gestureEnabled: false,
  contentStyle: CONTENT_STYLE,
} as const;

/**
 * Tab screens. D1 + D2: the scenes had no background of their own, so each tab switch cross-faded
 * two transparent layers and the window (black on most Android phones) showed through — that is
 * the flicker, and the two half-transparent scenes on top of each other are what made the cards
 * look dimmed. Now every scene is opaque, and the switch is instant instead of a cross-fade.
 * `freezeOnBlur` is off as well: unfreezing a blurred tab cost a blank frame on focus.
 */
export const TAB_SCREEN = {
  headerShown: false,
  animation: "none",
  sceneStyle: CONTENT_STYLE,
  freezeOnBlur: false,
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
