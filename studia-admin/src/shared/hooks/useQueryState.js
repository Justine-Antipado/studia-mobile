import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keep list state (page, page size, sort, search, filters) in the URL, so a
 * filtered table can be bookmarked, shared and survives a reload or a Back.
 *
 * const [query, setQuery] = useQueryState({ page: 1, pageSize: 20, q: '', role: 'All' });
 * setQuery({ role: 'Student' })   // resets page to 1 automatically
 *
 * Values equal to the default are dropped from the URL, so /users stays clean.
 */
const parse = (raw, fallback) => {
  if (raw === null) return fallback;
  if (typeof fallback === 'number') {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
  if (typeof fallback === 'boolean') return raw === 'true';
  return raw;
};

export function useQueryState(defaults = {}, { resetPageOn = [] } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useMemo(() => {
    const out = {};
    for (const [key, fallback] of Object.entries(defaults)) {
      out[key] = parse(searchParams.get(key), fallback);
    }
    return out;
    // defaults is a literal at the call site; compare by its serialized keys
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, JSON.stringify(defaults)]);

  const setQuery = useCallback(
    (patch, { replace = false } = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const changed = Object.keys(patch);
          const touchesFilter =
            changed.some((k) => k !== 'page' && (resetPageOn.length === 0 || resetPageOn.includes(k)));
          const merged = touchesFilter && !changed.includes('page') ? { ...patch, page: 1 } : patch;

          for (const [key, value] of Object.entries(merged)) {
            const isDefault = value === defaults[key];
            if (value === undefined || value === null || value === '' || isDefault) next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSearchParams, JSON.stringify(defaults), JSON.stringify(resetPageOn)]
  );

  const reset = useCallback(() => setSearchParams(new URLSearchParams(), { replace: true }), [setSearchParams]);

  return [query, setQuery, reset];
}
