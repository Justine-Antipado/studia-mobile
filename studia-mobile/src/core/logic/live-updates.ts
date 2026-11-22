// live-updates.ts: keeps the app current without closing it and signing in again.
//   - returning to the app after a while reloads every query
//   - a new row in `notifications` (created by database triggers for new announcements, lessons,
//     assignments, quizzes, grades, ...) arrives over Supabase Realtime and reloads every query
// Mounted once in the root layout.
import { useEffect } from "react";
import { AppState } from "react-native";

import { queryCache } from "@/core/data/cache/query-cache";
import { useUser } from "@/core/data/storage/session-store";
import { getSupabase, supabaseConfigured } from "@/core/data/supabase/client";

const STALE_AFTER_MS = 20_000;

export function useLiveUpdates(): void {
  const signedIn = !!useUser();

  useEffect(() => {
    if (!signedIn) return;
    let hiddenAt: number | null = null;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER_MS) queryCache.clear();
        // Realtime sleeps while the app is in the background, so catch up on the alerts right away.
        else queryCache.invalidate("notifications");
        hiddenAt = null;
      } else if (hiddenAt === null) {
        hiddenAt = Date.now();
      }
    });
    return () => sub.remove();
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !supabaseConfigured) return;
    const client = getSupabase();
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void client.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (cancelled || !uid) return;
      const channel = client
        .channel(`notifications:${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, () => {
          queryCache.clear();
        })
        .subscribe();
      cleanup = () => void client.removeChannel(channel);
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [signedIn]);
}
