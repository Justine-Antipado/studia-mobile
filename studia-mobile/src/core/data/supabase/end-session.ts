// end-session.ts: revoke the current device's Supabase session. Called by core/logic/sign-out.ts.
import { isRemote } from "@/core/config/data-source";
import { getSupabase, supabaseConfigured } from "@/core/data/supabase/client";

let ending = false;
/** True while WE are signing out, so the SIGNED_OUT listener does not run the sign-out twice. */
export const isEndingSession = () => ending;

/** Revokes this device's refresh token on the server and wipes the secure-store copy. Never throws. */
export async function endRemoteSession(): Promise<void> {
  if (!isRemote || !supabaseConfigured) return;
  ending = true;
  try {
    await getSupabase().auth.signOut({ scope: "local" });
  } catch {
    /* offline: the local copy is still removed by supabase-js; the server token expires on its own */
  } finally {
    ending = false;
  }
}
