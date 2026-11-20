// client.ts: the single Supabase client (anon key only; the service-role key never ships in the app).
import { AppState } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../../shared-types/database.types";

import { REMOTE_ENV } from "@/core/config/data-source";
import { secureStorage } from "@/core/data/supabase/secure-storage";

export type Db = SupabaseClient<Database>;

export const supabaseConfigured = Boolean(REMOTE_ENV.supabaseUrl && REMOTE_ENV.supabaseAnonKey);

let client: Db | null = null;

export function getSupabase(): Db {
  if (!supabaseConfigured) throw new Error("Supabase is not configured (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY).");
  if (client) return client;
  client = createClient<Database>(REMOTE_ENV.supabaseUrl, REMOTE_ENV.supabaseAnonKey, {
    auth: {
      storage: secureStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  const auth = client.auth;
  // Refresh tokens only while the app is in the foreground (the documented RN pattern).
  AppState.addEventListener("change", (state) => {
    if (state === "active") void auth.startAutoRefresh();
    else void auth.stopAutoRefresh();
  });
  void auth.startAutoRefresh();
  return client;
}

/** A throw-away client that never persists: used for the short-lived reset/profile sessions. */
export function createEphemeralClient(): Db {
  return createClient<Database>(REMOTE_ENV.supabaseUrl, REMOTE_ENV.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
