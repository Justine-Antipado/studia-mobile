// sign-out.ts — the ONE way to end a session, and the one place caches are purged.
//
// SECURITY: the QueryCache and the image disk cache hold another user's class lists, submissions,
// grades and avatars. Dropping the session without clearing them would show the previous account's
// data to the next one on the same device, so every exit path (logout, role switch, a future
// token expiry) must go through here rather than calling setUser(null) on its own.
import { queryCache } from "@/core/data/cache/query-cache";
import { endRemoteSession } from "@/core/data/supabase/end-session";
import { setUser } from "@/core/data/storage/session-store";
import { clearImageCache } from "@/shared/components/ui/app-image";

/** Query cache + image memory/disk cache. Never touches the session itself. */
export async function clearAllCaches(): Promise<void> {
  queryCache.clear();
  await clearImageCache();
}

/** Clears the session and every cache. Navigation is the caller's job. */
export async function signOut(): Promise<void> {
  await endRemoteSession(); // revoke the server session first; a no-op in mock mode
  setUser(null);
  await clearAllCaches();
}
