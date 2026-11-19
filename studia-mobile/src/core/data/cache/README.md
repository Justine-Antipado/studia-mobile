# core data cache

`query-cache.ts` — stale-while-revalidate cache (`QueryCache`) keyed by `cache-keys.ts`'s
`cacheKey()`, backed by the `CacheStore` interface in `cache-store.ts` (in-memory for now).
`core/data/repository/use-query.ts` reads through it; mutations call `queryCache.invalidate()`.
