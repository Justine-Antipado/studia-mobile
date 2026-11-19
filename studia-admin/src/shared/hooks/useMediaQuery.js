import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query. useSyncExternalStore keeps the value in step
 * with the browser without an effect, so there is no extra render after mount.
 */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Below this width every table renders as stacked cards (see DataTable). */
export const COMPACT_QUERY = '(max-width: 720px)';

export const useIsCompact = () => useMediaQuery(COMPACT_QUERY);
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
