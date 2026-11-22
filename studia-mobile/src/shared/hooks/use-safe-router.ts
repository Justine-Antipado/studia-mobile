// use-safe-router.ts
// Drop-in for expo-router's useRouter() whose push() is navigation-locked:
//   - After a push, THIS screen cannot push again until it is focused again (the user came back
//     from the sub page). So a multi-tap opens ONE page, however long the transition takes.
//   - The lock only ever belongs to the screen that pushed, so the page it opened can navigate
//     further straight away.
//   - Safety: if the screen never loses focus (the push was deduped, guarded or errored, so
//     nothing opened), the lock lifts after SAFETY_UNLOCK_MS instead of freezing the screen.
//   - A short global window (DOUBLE_TAP_MS) also drops any push right after another one, as a
//     second guard against a double tap.
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useRef } from "react";

const SAFETY_UNLOCK_MS = 1800;
/** A push this soon after the previous one is a double tap. */
const DOUBLE_TAP_MS = 700;

let lastPushAt = 0;

type Lock = { locked: boolean; blurred: boolean; timer: ReturnType<typeof setTimeout> | null };

function unlock(lock: Lock) {
  lock.locked = false;
  lock.blurred = false;
  if (lock.timer) clearTimeout(lock.timer);
  lock.timer = null;
}

export function useSafeRouter() {
  const router = useRouter();
  const lock = useRef<Lock>({ locked: false, blurred: false, timer: null }).current;

  useFocusEffect(
    useCallback(() => {
      // Back on this screen after the sub page closed -> unlock. (Focus before any blur is just
      // the push starting, not the user coming back.)
      if (lock.locked && lock.blurred) unlock(lock);
      return () => {
        if (!lock.locked) return;
        // This screen lost focus: the page really opened. Keep the lock until it is focused again.
        lock.blurred = true;
        if (lock.timer) clearTimeout(lock.timer);
        lock.timer = null;
      };
    }, [lock]),
  );

  return useMemo(
    () => ({
      ...router,
      push: (href: Href) => {
        const now = Date.now();
        if (lock.locked || now - lastPushAt < DOUBLE_TAP_MS) return;
        lastPushAt = now;
        lock.locked = true;
        lock.blurred = false;
        lock.timer = setTimeout(() => unlock(lock), SAFETY_UNLOCK_MS);
        router.push(href);
      },
    }),
    [router, lock],
  );
}
