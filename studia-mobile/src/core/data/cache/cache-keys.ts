// cache-keys.ts — the ONE place cache keys are built. Never hand-type a cache key string.
export type CacheKeyPart = string | number | boolean | null | undefined;

export function cacheKey(...parts: CacheKeyPart[]): string {
  return parts.filter((p) => p !== undefined && p !== null && p !== "").map(String).join(":");
}
