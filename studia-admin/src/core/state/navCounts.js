/**
 * NAV COUNTS — the sidebar badges and the topbar bell dot read from here, so a
 * page can clear a badge the moment the user acts instead of waiting for the
 * next shell refresh. The Layout seeds it from api.getNavCounts(); a page that
 * changes one of the numbers patches it optimistically and rolls back on error.
 */
import { useSyncExternalStore } from 'react';

const EMPTY = Object.freeze({});
let counts = EMPTY;
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const snapshot = () => counts;

/** Replace every count (used by the Layout when the shell fetch resolves). */
export function setNavCounts(next) {
  counts = next ? { ...next } : EMPTY;
  emit();
}

/**
 * Merge a few counts, leaving the rest alone. Returns the previous value, so a
 * failed request can hand it straight back to restoreNavCounts().
 */
export function patchNavCounts(patch) {
  const previous = counts;
  counts = { ...counts, ...patch };
  emit();
  return previous;
}

/** Restore a snapshot returned by patchNavCounts. */
export function restoreNavCounts(previous) {
  counts = previous ?? EMPTY;
  emit();
}

export function useNavCounts() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
