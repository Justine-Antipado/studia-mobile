import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'wheel', 'touchstart', 'visibilitychange'];

/**
 * Log the admin out after a period of inactivity, with a warning first.
 *
 * useIdleTimeout({ minutes: 20, warnSeconds: 60, onTimeout: logout })
 * -> { warning, secondsLeft, stay }
 *
 * `warning` turns true a minute before the end; `stay()` dismisses it and
 * restarts the clock. Pass enabled: false to switch it off (e.g. on /login).
 *
 * The deadline lives in a ref, not in state, so the ticking clock causes a
 * render only once the warning is actually on screen.
 */
export function useIdleTimeout({ minutes = 20, warnSeconds = 60, onTimeout, enabled = true } = {}) {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(warnSeconds);

  const deadlineRef = useRef(0);
  const onTimeoutRef = useRef(onTimeout);
  const warningRef = useRef(false);

  const totalMs = Math.max(1, minutes) * 60_000;

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    warningRef.current = warning;
  }, [warning]);

  /** Restart the clock. Safe to call from an event handler or a button. */
  const reset = useCallback(() => {
    deadlineRef.current = Date.now() + totalMs;
    warningRef.current = false;
    setWarning(false);
    setSecondsLeft(warnSeconds);
  }, [totalMs, warnSeconds]);

  useEffect(() => {
    if (!enabled) return undefined;
    deadlineRef.current = Date.now() + totalMs;

    const onActivity = () => {
      if (document.visibilityState === 'hidden') return;
      // While the warning is up, only the explicit "Stay signed in" counts.
      if (warningRef.current) return;
      deadlineRef.current = Date.now() + totalMs;
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const tick = setInterval(() => {
      const remaining = deadlineRef.current - Date.now();
      if (remaining <= 0) {
        setWarning(false);
        onTimeoutRef.current?.();
        return;
      }
      const left = Math.ceil(remaining / 1000);
      if (left <= warnSeconds) {
        setWarning(true);
        setSecondsLeft(left);
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(tick);
    };
  }, [enabled, totalMs, warnSeconds]);

  return { warning: enabled && warning, secondsLeft, stay: reset };
}
