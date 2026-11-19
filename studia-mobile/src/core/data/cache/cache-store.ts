// cache-store.ts — persistence behind the QueryCache. In-memory now; an AsyncStorage-backed
// implementation can be dropped in later without touching QueryCache or any hook.
export interface CacheStore {
  get(key: string): unknown | undefined;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  keys(): string[];
  clear(): void;
}

export class MemoryCacheStore implements CacheStore {
  private map = new Map<string, unknown>();

  get(key: string): unknown | undefined {
    return this.map.get(key);
  }
  set(key: string, value: unknown): void {
    this.map.set(key, value);
  }
  delete(key: string): void {
    this.map.delete(key);
  }
  keys(): string[] {
    return Array.from(this.map.keys());
  }
  clear(): void {
    this.map.clear();
  }
}
