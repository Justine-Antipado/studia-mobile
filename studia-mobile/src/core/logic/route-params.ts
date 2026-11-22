// route-params.ts — NEVER trust a route param. Deep links and cold starts can carry anything,
// so every id/number/enum coming from the URL is validated here before it reaches a repository.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";

/** Ids we generate: letters, digits, dash, underscore, 1..64 chars (no path or query chars). */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** Returns the id only when it is well formed, otherwise null (screen shows "not found"). */
export function parseId(value: string | string[] | undefined): string | null {
  const raw = first(value)?.trim();
  return raw && ID_PATTERN.test(raw) ? raw : null;
}

/** Validates a param against a fixed set of allowed values (role, tab name, difficulty...). */
export function parseEnum<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T | null {
  const raw = first(value)?.trim();
  return allowed.find((a) => a === raw) ?? null;
}

/**
 * Validated `id` of a detail route:
 *   const id = useRouteId();            // "c1" | null
 *   const { id, classId } = useRouteIds("id", "classId");
 */
export function useRouteId(name = "id"): string | null {
  const params = useLocalSearchParams();
  return useMemo(() => parseId(params[name]), [params, name]);
}

/**
 * An enum param kept in the URL, so the selection survives navigating to a child screen and
 * back (and makes the tab deep-linkable). The value is validated against `allowed`, so a
 * hand-typed deep link can never put the screen in a state it does not have.
 *
 *   const [tab, setTab] = useRouteEnum("tab", TABS, "Stream");
 */
export function useRouteEnum<T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const params = useLocalSearchParams();
  const router = useRouter();
  const value = parseEnum(params[name], allowed) ?? fallback;

  const setValue = useCallback(
    (next: T) => {
      if (allowed.includes(next)) router.setParams({ [name]: next });
    },
    // `allowed` is a module-level constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, name],
  );

  return [value, setValue];
}

export function useRouteIds<K extends string>(...names: K[]): Record<K, string | null> {
  const params = useLocalSearchParams();
  const key = names.join(",");
  return useMemo(() => {
    const out = {} as Record<K, string | null>;
    for (const name of names) out[name] = parseId(params[name]);
    return out;
    // names is captured by `key` so the memo is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, key]);
}
