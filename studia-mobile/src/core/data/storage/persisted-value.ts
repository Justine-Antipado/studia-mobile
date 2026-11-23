// persisted-value.ts — one typed, device-persisted value, read synchronously once hydrated.
//
// A PersistedValue never trusts what it reads back: every load goes through the `parse` guard
// given at construction, so a corrupted or outdated payload falls back to the default instead of
// flowing into the UI as an unchecked cast. Subscribe with usePersistedValue() to re-render on
// change (same useSyncExternalStore pattern as core/data/storage/session-store.ts).
import { useCallback, useSyncExternalStore } from "react";

import { deviceStore, STORAGE_PREFIX, type KeyValueStore } from "@/core/data/storage/key-value-store";

/** Returns the value when the raw JSON is valid, or undefined to fall back to the default. */
export type Parse<T> = (raw: unknown) => T | undefined;

/** What a subscriber sees. One frozen object per state change, so useSyncExternalStore can
 *  compare by reference and still notice hydration that did not change the value. */
export type PersistedSnapshot<T> = { readonly value: T; readonly hydrated: boolean };

export class PersistedValue<T> {
  private readonly storageKey: string;
  private current: T;
  private hydratedFlag = false;
  private snapshot: PersistedSnapshot<T>;
  private loading: Promise<T> | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    key: string,
    private readonly fallback: T,
    private readonly parse: Parse<T>,
    private readonly store: KeyValueStore = deviceStore,
  ) {
    this.storageKey = `${STORAGE_PREFIX}${key}`;
    this.current = fallback;
    this.snapshot = { value: fallback, hydrated: false };
  }

  /** True once the device value has been read (or found missing). */
  get hydrated(): boolean {
    return this.hydratedFlag;
  }

  /** The value right now: the default until hydration finishes. */
  peek(): T {
    return this.current;
  }

  /** Reads the device value once; later calls return the cached result. */
  async load(): Promise<T> {
    if (this.hydratedFlag) return this.current;
    this.loading ??= this.readOnce();
    return this.loading;
  }

  async set(value: T): Promise<void> {
    this.hydratedFlag = true;
    this.current = value;
    this.emit();
    await this.store.set(this.storageKey, JSON.stringify(value));
  }

  /** Back to the default, on the device too (used by sign-out and by "forget this device"). */
  async remove(): Promise<void> {
    this.hydratedFlag = true;
    this.current = this.fallback;
    this.emit();
    await this.store.remove(this.storageKey);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): PersistedSnapshot<T> => this.snapshot;

  private async readOnce(): Promise<T> {
    const raw = await this.store.get(this.storageKey);
    if (raw !== null) {
      const parsed = this.parse(safeJsonParse(raw));
      if (parsed !== undefined) this.current = parsed;
    }
    this.hydratedFlag = true;
    this.emit();
    return this.current;
  }

  private emit(): void {
    this.snapshot = { value: this.current, hydrated: this.hydratedFlag };
    this.listeners.forEach((l) => l());
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Ready-made guard for the common case: a stored boolean. */
export const parseBoolean: Parse<boolean> = (raw) => (typeof raw === "boolean" ? raw : undefined);

/** Guard for a stored string restricted to a known set. */
export function parseOneOf<T extends string>(allowed: readonly T[]): Parse<T> {
  return (raw) => (typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined);
}

/**
 * Subscribes a component to a PersistedValue. Returns the current value, whether the device read
 * has finished (gate navigation on this, not on the value), and a setter.
 */
export function usePersistedValue<T>(value: PersistedValue<T>): {
  value: T;
  hydrated: boolean;
  set: (next: T) => void;
} {
  const snapshot = useSyncExternalStore(value.subscribe, value.getSnapshot, value.getSnapshot);
  const set = useCallback((next: T) => void value.set(next), [value]);
  return { value: snapshot.value, hydrated: snapshot.hydrated, set };
}
