// inflight.ts — how many useQuery fetches are running right now, for the whole app.
//
// Why it exists: a screen that passes its own `onRefresh` spins for exactly as long as its
// request. A screen that does not gets Screen's fallback, which clears the cache and lets every
// mounted query revalidate — and there is no single promise to await for that. This counter is
// that signal, so the fallback spinner can follow the real reload instead of a fixed timer and
// pull-to-refresh behaves the same on every screen.
import { useSyncExternalStore } from "react";

let running = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Called by useQuery only — one start per fetch, one done per fetch (in a finally). */
export const inflight = {
  start(): void {
    running += 1;
    emit();
  },
  done(): void {
    running = Math.max(0, running - 1);
    emit();
  },
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A boolean, not the count: Screen only re-renders when the app goes busy / idle. */
const isFetching = () => running > 0;

/** True while any query in the app is fetching. */
export function useAnyQueryFetching(): boolean {
  return useSyncExternalStore(subscribe, isFetching, isFetching);
}
