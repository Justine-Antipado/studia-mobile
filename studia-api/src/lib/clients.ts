import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../shared-types/database.types.js";
import { env } from "./env.js";

export type Db = SupabaseClient<Database>;
const opts = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/** Service role: bypasses RLS. Use only for the specific writes each endpoint needs. */
export const adminClient = (): Db => createClient<Database>(env.supabaseUrl(), env.serviceKey(), opts);
/** Anon key, no stored session: performs the same Auth calls a client would. */
export const anonClient = (): Db => createClient<Database>(env.supabaseUrl(), env.anonKey(), opts);
