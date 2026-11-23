// avatars.ts: profile photos of other people (classmates, the instructor, the students of your class).
//
// Photos sit in the private `avatars` bucket, so each one needs a signed URL, and migration 029 only lets
// people who study together get one. This module is the cache in front of that:
//   - one batched round trip: avatar_paths(ids) -> createSignedUrls(paths); many <Avatar>s on one screen
//     ask for their ids in the same tick and share the single request
//   - in memory: id -> { path, signed URL }; the URL is reused for ~20 h (it is valid for 24 h), the path
//     is re-checked every 2 h so a new photo shows up without restarting the app
//   - on disk: expo-image keeps the picture bytes under a cacheKey built from the storage path, so the
//     same photo is not downloaded again when the signed URL changes, and a NEW photo (new path) is
//     fetched once. sign-out clears all of it (see core/logic/sign-out.ts).
// Failing quietly on purpose: no photo or no connection just means the initials are shown.
import { useEffect, useSyncExternalStore } from "react";

import { getSupabase, supabaseConfigured } from "@/core/data/supabase/client";
import { reportError } from "@/core/logic/report-error";

const URL_TTL_SEC = 24 * 60 * 60;
const URL_REUSE_MS = 20 * 60 * 60_000;
const PATH_RECHECK_MS = 2 * 60 * 60_000;
const NO_PHOTO_RECHECK_MS = 5 * 60_000;
const BATCH_DELAY_MS = 30;
const BATCH_SIZE = 100; // avatar_paths takes at most 200 ids

export type AvatarSource = { uri: string; cacheKey: string };

type Entry = {
  path: string | null;
  source: AvatarSource | null;
  signedAt: number;
  checkedAt: number;
};

const entries = new Map<string, Entry>();
const queue = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

function isFresh(entry: Entry | undefined, now: number): boolean {
  if (!entry) return false;
  return now - entry.checkedAt < (entry.path ? PATH_RECHECK_MS : NO_PHOTO_RECHECK_MS);
}

type RpcClient = { rpc: (fn: string, args: object) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

async function flush(): Promise<void> {
  timer = null;
  if (flushing || queue.size === 0) return;
  flushing = true;
  const ids = Array.from(queue).slice(0, BATCH_SIZE);
  ids.forEach((id) => queue.delete(id));
  const now = Date.now();
  try {
    const client = getSupabase();
    const { data, error } = await (client as unknown as RpcClient).rpc("avatar_paths", { p_ids: ids });
    if (error) throw new Error(error.message);
    const rows = (Array.isArray(data) ? data : []) as { id: string; path: string }[];
    const pathOf = new Map(rows.map((r) => [r.id, r.path]));

    // Sign only what is new or about to expire; everything else keeps its URL.
    const toSign = rows.filter((r) => {
      const e = entries.get(r.id);
      return !e || e.path !== r.path || !e.source || now - e.signedAt > URL_REUSE_MS;
    });
    const signed = new Map<string, string>();
    if (toSign.length) {
      const res = await client.storage.from("avatars").createSignedUrls(toSign.map((r) => r.path), URL_TTL_SEC);
      if (res.error) throw new Error(res.error.message);
      for (const item of res.data ?? []) if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
    }

    for (const id of ids) {
      const path = pathOf.get(id) ?? null;
      const prev = entries.get(id);
      if (!path) {
        entries.set(id, { path: null, source: null, signedAt: now, checkedAt: now });
      } else if (signed.has(path)) {
        entries.set(id, { path, source: { uri: signed.get(path)!, cacheKey: `avatar:${path}` }, signedAt: now, checkedAt: now });
      } else if (prev && prev.path === path) {
        entries.set(id, { ...prev, checkedAt: now });
      }
    }
    notify();
  } catch (e) {
    reportError(e, { scope: "avatars.flush" });
    // Do not hammer a failing server: remember the attempt so the next request waits.
    for (const id of ids) {
      const prev = entries.get(id);
      entries.set(id, { path: prev?.path ?? null, source: prev?.source ?? null, signedAt: prev?.signedAt ?? 0, checkedAt: now });
    }
  } finally {
    flushing = false;
    if (queue.size > 0) schedule();
  }
}

function schedule(): void {
  if (timer === null) timer = setTimeout(() => void flush(), BATCH_DELAY_MS);
}

/** Ask for these people's photos. Safe to call often: only missing or stale ids cause a request. */
export function requestAvatars(ids: readonly string[]): void {
  if (!supabaseConfigured) return;
  const now = Date.now();
  let added = false;
  for (const id of ids) {
    if (id && !isFresh(entries.get(id), now) && !queue.has(id)) {
      queue.add(id);
      added = true;
    }
  }
  if (added) schedule();
}

/** The photo of one person, or null while loading / when they have none. Triggers the fetch. */
export function useAvatarSource(userId: string | null | undefined): AvatarSource | null {
  useEffect(() => {
    if (userId) requestAvatars([userId]);
  }, [userId]);
  return useSyncExternalStore(
    subscribe,
    () => (userId ? (entries.get(userId)?.source ?? null) : null),
    () => null,
  );
}

/** After the user changes their own photo: forget every path so the new one is picked up. */
export function invalidateAvatars(): void {
  entries.clear();
  notify();
}

/** Sign-out: another account must not see this account's people. */
export function clearAvatarCache(): void {
  entries.clear();
  queue.clear();
  notify();
}
