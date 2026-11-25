// app-status.ts: the legal text (terms of use, privacy notice) the admin posts in Settings → Legal,
// read from the public `app_status()` database function. Fetched at launch (the splash waits briefly
// for it), again whenever the app returns to the foreground, and every few minutes while it is open,
// so text the admin updates reaches phones without a restart.
//
// Maintenance mode and the required-update rule used to come through here too, and blocked the app
// from core/logic/maintenance.ts. That whole feature was removed along with the admin's Settings →
// System tab; `app_status()` still returns inert `maintenance` and `update` objects so that app
// builds released before the removal keep reading "nothing is blocked" (migration 040).
//
// Failing quietly on purpose: if the request fails (offline, Supabase down) the last known text
// stays, and with none the screens that show it simply leave the section out.
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { z } from "zod";

import { getSupabase, supabaseConfigured } from "@/core/data/supabase/client";
import { reportError } from "@/core/logic/report-error";

const POLL_MS = 5 * 60_000;
const FIRST_FETCH_WAIT_MS = 3_000;

export type AppStatus = {
  legal: { terms: string; privacy: string; updatedAt: string | null };
};

let current: AppStatus | null = null;
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

type RpcClient = { rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

/**
 * The shape is checked, not assumed: this payload is built from admin-typed JSON in the `settings`
 * table, and a surprise here would otherwise reach the screens that render it. `catch` rather than
 * strict parsing, so a field the server adds later cannot blank out the text.
 */
const text = z.string().catch("");
const StatusSchema = z.object({
  legal: z
    .object({ terms: text, privacy: text, updatedAt: z.string().nullable().catch(null) })
    .catch({ terms: "", privacy: "", updatedAt: null }),
});

export async function refreshAppStatus(): Promise<void> {
  if (!supabaseConfigured) return;
  try {
    const { data, error } = await (getSupabase() as unknown as RpcClient).rpc("app_status");
    if (error) throw new Error(error.message);
    const parsed = StatusSchema.safeParse(data);
    if (!parsed.success) throw new Error("app_status returned an unexpected shape");
    current = { legal: parsed.data.legal };
    listeners.forEach((l) => l());
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
