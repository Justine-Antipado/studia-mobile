import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Count a number up from 0 on mount (and on every later change), so a KPI tile
 * animates into place instead of popping in. Non-numbers and a
 * `prefers-reduced-motion: reduce` preference both return the target at once.
 */
export function useCountUp(target, duration = 700) {
  const numeric = typeof target === 'number' && Number.isFinite(target);
  // Nothing to animate: the target is returned as-is and no state is written.
  const skip = !numeric || target === 0 || prefersReducedMotion();
  const [value, setValue] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (skip) return undefined;

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic: fast first, settling at the end
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [skip, target, duration]);

  return skip ? target : value;
}
