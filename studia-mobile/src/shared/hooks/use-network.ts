// use-network.ts — connectivity for the offline banner and for blocking writes.
//
// The state lives in a module-level store, not in each component, so that non-React code can
// read it too: use-mutation checks it before a write, which is how an offline write fails with a
// clear message instead of hanging and then timing out.
import NetInfo from "@react-native-community/netinfo";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

let online = true;
let started = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function setOnline(connected: boolean | null): void {
  // `null` means "unknown": treat it as online rather than locking the UI on a bad reading.
  const next = connected !== false;
  if (next === online) return;
  online = next;
  emit();
}

/** Starts on the first subscriber and then stays up for the life of the app. */
function start(): void {
  if (started) return;
  started = true;
  NetInfo.addEventListener((state) => setOnline(state.isConnected));
  void NetInfo.fetch().then((state) => setOnline(state.isConnected));
  // Coming back from the background: the OS does not always deliver an event for what changed
  // while the app was suspended.
  AppState.addEventListener("change", (next) => {
    if (next === "active") void NetInfo.fetch().then((state) => setOnline(state.isConnected));
  });
}

const subscribe = (listener: () => void) => {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => online;

/** Read outside React (repositories, use-mutation). Components use useNetwork(). */
export function isOnline(): boolean {
  start();
  return online;
}

export function useNetwork(): { isOnline: boolean } {
  const connected = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { isOnline: connected };
}
