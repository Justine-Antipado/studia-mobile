import { type Href, useRouter } from "expo-router";
import { useCallback } from "react";

/** Back button that never dead-ends (deep links / cold start have no history). */
export function useSafeBack(fallback: Href = "/instructor/home") {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
