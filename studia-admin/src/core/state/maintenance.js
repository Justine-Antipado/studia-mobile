/**
 * The live maintenance document, shared by the shell and Settings → System, so
 * saving a window raises the top-bar banner immediately instead of after the
 * next settings fetch. Same tiny store pattern as core/state/navCounts.js.
 */
import { useSyncExternalStore } from 'react';
import { EMPTY_MAINTENANCE, normalizeMaintenance } from '../logic/maintenance';

let current = EMPTY_MAINTENANCE;
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const snapshot = () => current;

/** Returns the previous document, so a failed save can hand it back. */
export function setMaintenance(next, legacyFlag = false) {
  const previous = current;
  current = normalizeMaintenance(next, legacyFlag);
  listeners.forEach((l) => l());
  return previous;
}

export function useMaintenance() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
