// key-value-store.ts — the async device-storage port. UI, caches and flags depend on this
// interface, never on AsyncStorage directly (dependency inversion), so the backing store can be
// swapped (memory in tests, SQLite/MMKV later) without touching a caller.
//
// NOT for secrets: tokens and the Supabase session go to expo-secure-store
// (core/data/supabase/secure-storage.ts). Everything here is plain, device-local, user-clearable
// data — it disappears when the user clears the app's data in Android app info.
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** Every key currently held, used to hydrate a prefix (see PersistentCacheStore). */
  keys(): Promise<string[]>;
  getMany(keys: readonly string[]): Promise<[string, string | null][]>;
  setMany(entries: readonly [string, string][]): Promise<void>;
  removeMany(keys: readonly string[]): Promise<void>;
}

/** Device-backed implementation. Never throws: storage failure must not break a screen. */
class AsyncStorageStore implements KeyValueStore {
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      /* out of space / storage disabled: the in-memory copy still works */
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  async keys(): Promise<string[]> {
    try {
      return [...(await AsyncStorage.getAllKeys())];
    } catch {
      return [];
    }
  }

  async getMany(keys: readonly string[]): Promise<[string, string | null][]> {
    if (keys.length === 0) return [];
    try {
      const rows = await AsyncStorage.multiGet([...keys]);
      return rows.map(([k, v]) => [k, v ?? null]);
    } catch {
      return keys.map((k) => [k, null]);
    }
  }

  async setMany(entries: readonly [string, string][]): Promise<void> {
    if (entries.length === 0) return;
    try {
      await AsyncStorage.multiSet(entries.map(([k, v]) => [k, v]));
    } catch {
      /* ignore */
    }
  }

  async removeMany(keys: readonly string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await AsyncStorage.multiRemove([...keys]);
    } catch {
      /* ignore */
    }
  }
}

/** In-memory implementation for tests and for a store that must not persist. */
export class MemoryKeyValueStore implements KeyValueStore {
  private readonly map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }
  async keys(): Promise<string[]> {
    return [...this.map.keys()];
  }
  async getMany(keys: readonly string[]): Promise<[string, string | null][]> {
    return keys.map((k) => [k, this.map.get(k) ?? null]);
  }
  async setMany(entries: readonly [string, string][]): Promise<void> {
    entries.forEach(([k, v]) => this.map.set(k, v));
  }
  async removeMany(keys: readonly string[]): Promise<void> {
    keys.forEach((k) => this.map.delete(k));
  }
}

/** The app's one device store. Inject a MemoryKeyValueStore in tests instead of mocking modules. */
export const deviceStore: KeyValueStore = new AsyncStorageStore();

/** Namespace for everything this app writes, so keys never collide with a library's. */
export const STORAGE_PREFIX = "studia.";
