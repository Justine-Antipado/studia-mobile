import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { usePrefersReducedMotion } from '../hooks';

/**
 * Fade-and-rise on every route change, plus focus management: after a
 * navigation the focus moves to the page container so keyboard and screen
 * reader users land on the new content instead of staying in the sidebar.
 *
 * The animation is a CSS one keyed on the pathname; with
 * prefers-reduced-motion: reduce it is skipped entirely (no layout jump either
 * way, because the element never changes size).
 */
export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  const ref = useRef(null);
  const firstRender = useRef(true);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    ref.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [pathname, reduced]);

  return (
    <div
      ref={ref}
      key={pathname}
      tabIndex={-1}
      className={`page-transition ${reduced ? 'no-motion' : ''}`}
    >
      {children}
    </div>
  );
}
