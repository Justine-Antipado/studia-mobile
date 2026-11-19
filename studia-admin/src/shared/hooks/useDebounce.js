import { useCallback, useEffect, useRef, useState } from 'react';

/** The value, but only after it has stopped changing for `delay` ms. */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** A debounced callback with a stable identity that cancels on unmount. */
export function useDebouncedCallback(fn, delay = 300) {
  const timer = useRef(null);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback(
    (...args) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current?.(...args), delay);
    },
    [delay]
  );
}
