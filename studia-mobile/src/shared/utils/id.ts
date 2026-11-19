// id.ts — local id generation for mock records and for idempotency keys.
// Was copy-pasted into four repositories; one implementation now.
//
// NOTE: these are client-side ids for mock data and request de-duplication only. The backend
// assigns the real primary keys and must never trust an id that came from a client.

/** "as_m3k1p9x2b" — prefix keeps mock ids readable while debugging. */
export function newId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Key for a create/submit call so a retry cannot produce a second record. The repository passes
 * it through to the API, which must treat a repeat of the same key as the same request.
 */
export const newIdempotencyKey = () => newId("idem");
