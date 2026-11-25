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

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

/**
 * Escape hatch for the parts of the schema that `shared-types/database.types.ts` does not know yet.
 *
 * That file is generated from the live database and lags the migrations (the same reason
 * studia-mobile's core/data/supabase/remote.ts keeps an untyped `db()`). Migrations 032-038 add
 * functions, a `throttle_key` column and the `admin_login` enum value, so calls to them do not
 * typecheck until the types are regenerated:
 *
 *     npx supabase gen types typescript --project-id <id> > shared-types/database.types.ts
 *
 * Do that after `supabase db push` and replace these calls with the typed `db.rpc(...)`. Use this
 * ONLY for those; everything already in the generated types stays typed.
 */
export const untyped = (db: Db) =>
  db as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
    from: (table: string) => {
      insert: (row: Record<string, unknown>) => PromiseLike<RpcResult>;
    };
  };
