import { useCallback, useEffect, useRef, useState } from 'react';
import { isAborted, toApiError } from '../../core/data/http/errors';

/**
 * Run an async function and track { data, error, loading }.
 *
 * - The callback receives an AbortSignal; pass it on to the API call.
 * - Unmounting or re-running aborts the previous call, so a slow response can
 *   never overwrite a newer one.
 * - `reload()` retries; `setData` allows a rollback-able optimistic update.
 *
 * const { data, error, loading, reload } = useAsync(
 *   (signal) => api.getUsers(params, { signal }), [params]
 * );
 */
export function useAsync(fn, deps = [], { immediate = true, initialData = null } = {}) {
  const [state, setState] = useState({ data: initialData, error: null, loading: immediate });
  const controllerRef = useRef(null);
  const mountedRef = useRef(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const execute = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await run(controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return undefined;
      setState({ data, error: null, loading: false });
      return data;
    } catch (err) {
      const apiError = toApiError(err);
      if (!mountedRef.current || isAborted(apiError)) return undefined;
      setState((s) => ({ ...s, error: apiError, loading: false }));
      return undefined;
    }
  }, [run]);

  useEffect(() => {
    if (immediate) execute();
  }, [execute, immediate]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: execute, setData };
}

/**
 * The write counterpart: never auto-runs, never retries, refuses to start while
 * the browser is offline, and exposes `pending` so buttons can disable.
 */
export function useMutation(fn) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const mutate = useCallback(async (...args) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const offline = toApiError(new Error('You are offline. Reconnect and try again.'));
      setError(offline);
      throw offline;
    }
    setPending(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (err) {
      const apiError = toApiError(err);
      setError(apiError);
      throw apiError;
    } finally {
      setPending(false);
    }
  }, []);

  return { mutate, pending, error, reset: useCallback(() => setError(null), []) };
}
