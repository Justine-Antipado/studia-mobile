// use-safe-router.ts
// Drop-in for expo-router's useRouter() whose push() is navigation-locked: after a push,
// further pushes are ignored until the screen that pushed is focused again (the user came
// back from the sub page). This stops a multi-tap from stacking duplicate screens.
//   - ONE global lock, so tapping card A then card B mid-transition is ignored too.
//   - The lock is released only by the pushing screen regaining focus (a newly opened
//     screen mounting must not release it), with a safety timeout for pushes that never
//     navigate (deduped by getId, guarded, errored).
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useRef } from "react";

const SAFETY_UNLOCK_MS = 1800;

let owner: object | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function release() {
  owner = null;
  if (timer) clearTimeout(timer);
  timer = null;
}

export function useSafeRouter() {
  const router = useRouter();
  const me = useRef({}).current;

  // Back on this screen after a sub page closed -> unlock.
  useFocusEffect(
    useCallback(() => {
      if (owner === me) release();
    }, [me]),
  );

  return useMemo(
    () => ({
      ...router,
      push: (href: Href) => {
        if (owner) return;
        owner = me;
        timer = setTimeout(release, SAFETY_UNLOCK_MS);
        router.push(href);
      },
    }),
    [router, me],
  );
}
