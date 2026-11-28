// live-updates.ts: keeps the app current without closing it and signing in again.
//   - returning to the app after a while reloads every query
//   - a new row in `notifications` (created by database triggers for new announcements, lessons,
//     assignments, quizzes, grades, ...) arrives over Supabase Realtime and reloads every query
//   - the admin deactivating this account (status -> 'inactive') ends the session the next time
//     the app comes to the foreground (see STALE_AFTER_MS below). The UPDATE subscription further
//     down is meant to catch it instantly while the app stays open, but `public.users` was never
//     added to the `supabase_realtime` publication (only `public.notifications` was, migration
//     20260101000018) -- Realtime only broadcasts tables in that publication, so that handler
//     subscribes but never actually receives anything right now. Add the table to the publication
//     to make it live; until then, this is the only path that works.
// Mounted once in the root layout.
import { router } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";

import { queryCache } from "@/core/data/cache/query-cache";
import { useUser } from "@/core/data/storage/session-store";
import { getSupabase, supabaseConfigured } from "@/core/data/supabase/client";
import { signOut } from "@/core/logic/sign-out";
import { publishNotification, toIncoming } from "@/core/logic/notification-stream";
import type { Role } from "@/core/types/role";

const STALE_AFTER_MS = 20_000;

type StatusRow = { status?: string; deleted_at?: string | null } | null | undefined;

/** True once this account can no longer use the app (deactivated or deleted by the admin). */
const isBlocked = (row: StatusRow) => !row || row.status !== "active" || !!row.deleted_at;

/** Ends the session and sends the device to /auth with a banner explaining why. */
function forceSignOutBlocked(role: Role): void {
  void signOut();
  router.replace({ pathname: "/auth", params: { role, reason: "blocked" } });
}

export function useLiveUpdates(): void {
  const user = useUser();
  const signedIn = !!user;
  const role = user?.role;

  useEffect(() => {
    if (!signedIn || !role || !supabaseConfigured) return;
    const client = getSupabase();
    let hiddenAt: number | null = null;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER_MS) queryCache.clear();
        // Realtime sleeps while the app is in the background, so catch up on the alerts right away.
        else queryCache.invalidate("notifications");
        hiddenAt = null;
        // ...and on whether the admin deactivated this account while Realtime was asleep too.
        void client.auth.getSession().then(({ data }) => {
          const uid = data.session?.user.id;
          if (!uid) return;
          void client
            .from("users")
            .select("status, deleted_at")
            .eq("id", uid)
            .maybeSingle()
            .then(({ data: row, error }) => {
              // A failed read (offline, a slow reconnect after switching apps/networks, any
              // transient error) is not proof the account was deactivated -- it is proof we
              // could not ask. Treating "no answer" the same as "blocked" signed real, active
              // accounts out with a false "This account is deactivated" banner. Only a row that
              // actually says so may sign the device out; a failed check is retried next time
              // the app comes to the foreground instead.
              if (error) return;
              if (isBlocked(row)) forceSignOutBlocked(role);
            });
        });
      } else if (hiddenAt === null) {
        hiddenAt = Date.now();
      }
    });
    return () => sub.remove();
  }, [signedIn, role]);

  useEffect(() => {
    if (!signedIn || !role || !supabaseConfigured) return;
    const client = getSupabase();
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void client.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (cancelled || !uid) return;
      const channel = client
        .channel(`notifications:${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, (payload) => {
          queryCache.clear();
          // Also announce it in the app: the OS banner is suppressed while Studia is in the
          // foreground, so this toast is what the user actually sees (B1).
          const incoming = toIncoming(payload.new);
          if (incoming) publishNotification(incoming);
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${uid}` }, (payload) => {
          if (isBlocked(payload.new as StatusRow)) forceSignOutBlocked(role);
        })
        .subscribe();
      cleanup = () => void client.removeChannel(channel);
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [signedIn, role]);
}
