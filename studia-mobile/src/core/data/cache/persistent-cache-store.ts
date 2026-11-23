// persistent-cache-store.ts — a CacheStore that survives an app restart, so the first paint after
// a cold launch comes from the last known data instead of a spinner (offline-first; useQuery then
// revalidates in the background).
//
// Shape: an in-memory Map is the source of truth (CacheStore is synchronous, hooks read it during
// render) and every mutation is mirrored to the device store on a short debounce, batched. Writes
// are fire-and-forget: a storage failure must never break a screen.
//
// SECURITY: these entries are another account's data once the phone changes hands, so
// core/logic/sign-out.ts clears the QueryCache — which clears this store and the device keys with
// it. A SCHEMA bump also drops everything, so a changed payload shape can never be rehydrated.
import type { CacheStore } from "@/core/data/cache/cache-store";
import { deviceStore, STORAGE_PREFIX, type KeyValueStore } from "@/core/data/storage/key-value-store";

const NAMESPACE = `${STORAGE_PREFIX}qc.v1.`;
const FLUSH_MS = 400;

/** JSON has no Infinity, which TTL.ai relies on, so non-finite numbers travel as a tagged object. */
type Tagged = { readonly __num: "inf" | "-inf" };

const isTagged = (v: unknown): v is Tagged =>
  typeof v === "object" && v !== null && "__num" in v && typeof (v as Tagged).__num === "string";

function encode(value: unknown): string | null {
  try {
    return JSON.stringify(value, (_k, v: unknown) => {
      if (typeof v === "number" && !Number.isFinite(v)) {
        if (Number.isNaN(v)) return null;
        return { __num: v > 0 ? "inf" : "-inf" } satisfies Tagged;
      }
      return v;
    });
  } catch {
    return null; // not serializable (a function, a cycle): keep it in memory only
  }
}

function decode(raw: string): unknown {
  try {
    return JSON.parse(raw, (_k, v: unknown) =>
      isTagged(v) ? (v.__num === "inf" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : v,
    ) as unknown;
  } catch {
    return undefined;
  }
}

export class PersistentCacheStore implements CacheStore {
  private readonly map = new Map<string, unknown>();
  private readonly dirty = new Set<string>();
  private readonly removed = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private hydrated = false;

  constructor(private readonly store: KeyValueStore = deviceStore) {}

  /** Loads the persisted entries into memory. Call once, before the first render. */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    const keys = (await this.store.keys()).filter((k) => k.startsWith(NAMESPACE));
    if (keys.length === 0) return;
    for (const [storageKey, raw] of await this.store.getMany(keys)) {
      if (raw === null) continue;
      const value = decode(raw);
      if (value === undefined) continue;
      const key = storageKey.slice(NAMESPACE.length);
      // A value written while hydrating is fresher than the device copy: never overwrite it.
      if (!this.map.has(key) && !this.removed.has(key)) this.map.set(key, value);
    }
  }

  get(key: string): unknown | undefined {
    return this.map.get(key);
  }

  set(key: string, value: unknown): void {
    this.map.set(key, value);
    this.removed.delete(key);
    this.dirty.add(key);
    this.schedule();
  }

  delete(key: string): void {
    this.map.delete(key);
    this.dirty.delete(key);
    this.removed.add(key);
    this.schedule();
  }

  keys(): string[] {
    return [...this.map.keys()];
  }

  clear(): void {
    const keys = this.keys();
    this.map.clear();
    this.dirty.clear();
    keys.forEach((k) => this.removed.add(k));
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, FLUSH_MS);
  }

  /** Writes the pending changes. Exposed for tests and for a deliberate flush before exit. */
  async flush(): Promise<void> {
    const writes: [string, string][] = [];
    for (const key of this.dirty) {
      const encoded = encode(this.map.get(key));
      if (encoded !== null) writes.push([`${NAMESPACE}${key}`, encoded]);
    }
    const deletes = [...this.removed].map((k) => `${NAMESPACE}${k}`);
    this.dirty.clear();
    this.removed.clear();
    await Promise.all([this.store.setMany(writes), this.store.removeMany(deletes)]);
  }
}
