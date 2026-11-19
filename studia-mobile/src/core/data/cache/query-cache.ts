// query-cache.ts — key -> {data, fetchedAt, staleAt}. Hooks read through this: return cached
// data instantly, then revalidate in the background when stale (stale-while-revalidate).
// In-flight requests are deduped by key so the same fetch is never issued twice at once.
import { CacheStore, MemoryCacheStore } from "@/core/data/cache/cache-store";

export type CacheEntry<T> = { data: T; fetchedAt: number; staleAt: number };

type Listener = () => void;

export class QueryCache {
  constructor(private readonly store: CacheStore = new MemoryCacheStore()) {}

  private inflight = new Map<string, Promise<unknown>>();
  private listeners = new Map<string, Set<Listener>>();

  getEntry<T>(key: string): CacheEntry<T> | undefined {
    return this.store.get(key) as CacheEntry<T> | undefined;
  }

  isStale(key: string): boolean {
    const entry = this.getEntry(key);
    return !entry || entry.staleAt <= Date.now();
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, fetchedAt: Date.now(), staleAt: Date.now() + ttlMs });
    this.notify(key);
  }

  subscribe(key: string, listener: Listener): () => void {
    const set = this.listeners.get(key) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(key, set);
    return () => {
      set.delete(listener);
    };
  }

  private notify(key: string): void {
    this.listeners.get(key)?.forEach((l) => l());
  }

  /** Dedupe-aware fetch: concurrent callers for the same key share one in-flight promise. */
  async fetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;

    const promise = fetcher()
      .then((data) => {
        this.set(key, data, ttlMs);
        return data;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /** Invalidate one exact key, or every key sharing a `prefix:` (build prefixes with cacheKey). */
  invalidate(keyOrPrefix: string): void {
    for (const key of this.store.keys()) {
      if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
        this.store.delete(key);
        this.notify(key);
      }
    }
  }

  /** Clears everything. Call on logout and on role/user switch. */
  clear(): void {
    const keys = this.store.keys();
    this.store.clear();
    keys.forEach((key) => this.notify(key));
  }
}

/** One cache for the whole app — import this, never construct your own QueryCache. */
export const queryCache = new QueryCache();

/** Default TTLs by data shape. Pass one of these to useQuery, never a hand-typed number. */
export const TTL = {
  static: 5 * 60_000,
  live: 30_000,
  ai: Number.POSITIVE_INFINITY,
} as const;
