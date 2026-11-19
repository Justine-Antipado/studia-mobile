// use-safe-back.ts (v2)
// The ONE back handler. Every back button and the Android hardware back go through it, so:
//   - a deep link or cold start never dead-ends (no history -> replace with the logical parent),
//   - the fallback is the LOGICAL parent from docs/ROUTE-MAP.md, not just home,
//   - a screen with unsaved changes can intercept and show a confirm-discard dialog.
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback } from "react";
import { BackHandler, Platform } from "react-native";

export type SafeBackOptions = {
  /**
   * True while the screen holds unsaved changes. Back then calls onBlocked()
   * (open the confirm dialog) instead of leaving.
   */
  blocked?: boolean;
  onBlocked?: () => void;
  /** Set false to stop handling the Android hardware back (e.g. a modal is open). */
  handleHardwareBack?: boolean;
};

/**
 * @param fallback logical parent route, e.g. useSafeBack("/instructor/grading")
 */
export function useSafeBack(fallback: Href, options: SafeBackOptions = {}): () => void {
  const { blocked = false, onBlocked, handleHardwareBack = true } = options;
  const router = useRouter();

  const goBack = useCallback(() => {
    if (blocked) {
      onBlocked?.();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [blocked, onBlocked, router, fallback]);

  // Android hardware / gesture back, only while this screen is focused.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android" || !handleHardwareBack) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (blocked) {
          onBlocked?.();
          return true; // handled: stay on the screen and let the dialog decide
        }
        if (router.canGoBack()) return false; // let the navigator pop normally
        router.replace(fallback);
        return true;
      });
      return () => sub.remove();
    }, [blocked, onBlocked, handleHardwareBack, router, fallback]),
  );

  return goBack;
}

/** Leave the current screen ignoring the unsaved-changes block (the dialog confirmed). */
export function useForceBack(fallback: Href): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
