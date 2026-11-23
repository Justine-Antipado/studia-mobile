// app-status.ts: the admin's maintenance window, required-update rule and legal text, read from the
// public `app_status()` database function. Fetched at launch (the splash waits briefly for it), again
// whenever the app returns to the foreground, and every minute while it is open, so a window the admin
// opens or closes reaches phones without a restart.
//
// Failing open on purpose: if the request fails (offline, Supabase down) the last known status stays,
// and with none the app is not blocked: a network error must never lock everyone out.
import Constants from "expo-constants";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { getSupabase, supabaseConfigured } from "@/core/data/supabase/client";
import { reportError } from "@/core/logic/report-error";
import type { AppStatus } from "@/core/logic/maintenance";

const POLL_MS = 60_000;
const FIRST_FETCH_WAIT_MS = 3_000;

/** The version this build was released as (app.json `version`; bump it for every release). */
export const INSTALLED_VERSION: string = Constants.expoConfig?.version ?? "0.0.0";

let current: AppStatus | null = null;
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

type RpcClient = { rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

export async function refreshAppStatus(): Promise<void> {
  if (!supabaseConfigured) return;
  try {
    const { data, error } = await (getSupabase() as unknown as RpcClient).rpc("app_status");
    if (error) throw new Error(error.message);
    if (data && typeof data === "object") {
      current = data as AppStatus;
      listeners.forEach((l) => l());
    }
  } catch (e) {
    reportError(e, { scope: "app-status.refresh" });
  }
}

/** Resolves after the first fetch finished, or after a short wait, whichever is first. */
export const appStatusReady: Promise<void> = Promise.race([
  refreshAppStatus(),
  new Promise<void>((resolve) => setTimeout(resolve, FIRST_FETCH_WAIT_MS)),
]);

export const useAppStatus = (): AppStatus | null =>
  useSyncExternalStore(subscribe, () => current, () => current);

/** Mounted once in the root layout. */
export function useAppStatusSync(): void {
  useEffect(() => {
    const timer = setInterval(() => void refreshAppStatus(), POLL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshAppStatus();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
}
