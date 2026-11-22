// use-mutation.ts — writes. Never auto-retries (only reads do). Supports an optimistic cache
// edit that is rolled back automatically if the call fails, and invalidates the affected
// query keys on success so every screen reading them revalidates.
//
// Writes are also refused up front while the device is offline: one clear message here beats
// every form discovering it on its own after a timeout, and keeps the user's draft intact.
import { useCallback, useRef, useState } from "react";

import { appError, toAppError, type AppError, type Result } from "@/core/data/errors/app-error";
import { queryCache } from "@/core/data/cache/query-cache";
import { isOnline } from "@/shared/hooks/use-network";

export type MutationOptions<TArgs, TResult> = {
  /** Applied to the cache immediately; rolled back if the call fails. */
  optimistic?: { key: string; apply: (args: TArgs) => unknown };
  /** Key(s) to invalidate once the call succeeds. */
  invalidate?: (args: TArgs, result: TResult) => string | string[];
  /** Set for writes that are purely local (a draft, a UI preference) so offline still works. */
  allowOffline?: boolean;
};

const OFFLINE_ERROR = () =>
  appError("network", "You are offline. This will need a connection — your work is saved here.", true);

export type MutationState<TArgs, TResult> = {
  run: (args: TArgs) => Promise<Result<TResult>>;
  loading: boolean;
  error: AppError | null;
};

export function useMutation<TArgs, TResult>(
  mutate: (args: TArgs) => Promise<Result<TResult>>,
  options: MutationOptions<TArgs, TResult> = {},
): MutationState<TArgs, TResult> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  // Single-flight per argument set: a rapid double tap on "Post" / "Turn in" / "Delete" returns the
  // request already in progress instead of sending a second one (state updates are async, so the
  // `loading` flag alone cannot stop it). Different arguments (two different rows) still run.
  const inFlight = useRef(new Map<string, Promise<Result<TResult>>>());

  const execute = useCallback(
    async (args: TArgs): Promise<Result<TResult>> => {
      // Checked before the optimistic edit, so an offline attempt changes nothing at all.
      if (!options.allowOffline && !isOnline()) {
        const offline = OFFLINE_ERROR();
        setError(offline);
        return { ok: false, error: offline };
      }

      setLoading(true);
      setError(null);

      const snapshotEntry = options.optimistic ? queryCache.getEntry(options.optimistic.key) : undefined;
      const rollback = () => {
        if (!options.optimistic) return;
        // No entry before the optimistic write => drop the key, never store undefined as data.
        if (snapshotEntry) queryCache.set(options.optimistic.key, snapshotEntry.data, 0);
        else queryCache.invalidate(options.optimistic.key);
      };
      if (options.optimistic) options.optimistic.apply(args);

      try {
        const result = await mutate(args);
        if (!result.ok) {
          rollback();
          setError(result.error);
          return result;
        }
        const keys = options.invalidate?.(args, result.value);
        (Array.isArray(keys) ? keys : keys ? [keys] : []).forEach((k) => queryCache.invalidate(k));
        return result;
      } catch (e) {
        rollback();
        const appErr = toAppError(e);
        setError(appErr);
        return { ok: false, error: appErr };
      } finally {
        setLoading(false);
      }
    },
    // options is expected to hold stable closures from the calling hook
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutate],
  );

  const run = useCallback(
    (args: TArgs): Promise<Result<TResult>> => {
      let key: string;
      try {
        key = JSON.stringify(args) ?? "";
      } catch {
        key = "";
      }
      const pending = inFlight.current.get(key);
      if (pending) return pending;
      const promise = execute(args).finally(() => inFlight.current.delete(key));
      inFlight.current.set(key, promise);
      return promise;
    },
    [execute],
  );

  return { run, loading, error };
}
