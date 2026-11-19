// use-query.ts — the ONE hook every feature's useClasses()/useTasks()/... is built on.
// Reads the QueryCache synchronously (instant stale data), revalidates in the background when
// stale, retries retryable failures, and re-renders when another part of the app invalidates
// this key (e.g. posting an announcement invalidates its list).
import { useCallback, useEffect, useRef, useState } from "react";

import { toAppError, withRetry, type AppError, type Result } from "@/core/data/errors/app-error";
import { queryCache, TTL } from "@/core/data/cache/query-cache";

export type QueryState<T> = {
  data: T | undefined;
  loading: boolean;
  error: AppError | null;
  refetch: () => void;
  /** Local optimistic edit, kept until the next successful fetch replaces it. */
  mutate: (updater: (current: T | undefined) => T) => void;
};

export type UseQueryOptions = {
  ttlMs?: number;
  enabled?: boolean;
};

export function useQuery<T>(
  key: string | null,
  fetcher: () => Promise<Result<T>>,
  { ttlMs = TTL.static, enabled = true }: UseQueryOptions = {},
): QueryState<T> {
  const entry = key ? queryCache.getEntry<T>(key) : undefined;
  const [data, setData] = useState<T | undefined>(entry?.data);
  const [loading, setLoading] = useState(!entry && enabled && !!key);
  const [error, setError] = useState<AppError | null>(null);
  const generation = useRef(0);

  // Sync `data` and `loading` to this key's cached value the moment the key changes — adjusted
  // during render, per https://react.dev/learn/you-might-not-need-an-effect, not in an effect.
  const [syncedKey, setSyncedKey] = useState(key);
  if (key !== syncedKey) {
    setSyncedKey(key);
    const next = key ? queryCache.getEntry<T>(key) : undefined;
    setData(next?.data);
    setLoading(!next && enabled && !!key);
  }

  const run = useCallback(
    async (background: boolean) => {
      if (!key || !enabled) return;
      const gen = ++generation.current;
      if (!background) setLoading(true);
      const result = await withRetry(() =>
        fetcher()
          .then((r) => r)
          .catch((e) => ({ ok: false as const, error: toAppError(e) })),
      );
      if (gen !== generation.current) return; // a newer request/unmount won the race
      if (result.ok) {
        queryCache.set(key, result.value, ttlMs);
        setData(result.value);
        setError(null);
      } else {
        setError(result.error);
      }
      setLoading(false);
    },
    [key, enabled, fetcher, ttlMs],
  );

  useEffect(() => {
    if (!key || !enabled) return;
    const cached = queryCache.getEntry<T>(key);
    // Fresh cache: nothing to fetch (loading is already false — see the key sync above). Cached
    // but stale: revalidate in the background so the data stays on screen. Nothing cached: a
    // foreground fetch, which is the only case that shows a spinner.
    if (cached && !queryCache.isStale(key)) return;
    // Deferred a tick so the fetch (and its loading-state update) runs outside this effect's
    // own synchronous call stack, not to delay the request itself.
    const timer = setTimeout(() => void run(!!cached), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => {
    if (!key) return;
    return queryCache.subscribe(key, () => {
      const fresh = queryCache.getEntry<T>(key);
      if (fresh) {
        setData(fresh.data);
        return;
      }
      // The entry was invalidated (a mutation succeeded). Keep what is on screen and revalidate
      // in the background instead of blanking the list, which is what stale-while-revalidate
      // promises; blanking it was why the to-do list emptied itself after a check-off.
      if (enabled) void run(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => () => void (generation.current += 1), []);

  const refetch = useCallback(() => void run(false), [run]);

  const mutate = useCallback(
    (updater: (current: T | undefined) => T) => {
      setData((current) => {
        const next = updater(current);
        if (key) queryCache.set(key, next, ttlMs);
        return next;
      });
    },
    [key, ttlMs],
  );

  return { data, loading, error, refetch, mutate };
}
