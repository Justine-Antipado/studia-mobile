import { useCallback, useState } from 'react';

const EMPTY = { message: '', kind: 'ok' };

/**
 * One toast per page, with the two outcomes kept apart: `showToast` for a
 * success (purple, announced politely) and `showError` for a failure (red,
 * announced assertively). A catch block passes the error straight in and never
 * has to decide how to phrase it.
 *
 *   const { toast, showToast, showError, clearToast } = useToast();
 *   …
 *   <Toast message={toast.message} kind={toast.kind} onDone={clearToast} />
 */
export function useToast() {
  const [toast, setToast] = useState(EMPTY);

  const showToast = useCallback((message) => setToast({ message, kind: 'ok' }), []);

  const showError = useCallback((e) => {
    const message = typeof e === 'string' ? e : e?.message;
    setToast({ message: message || 'Something went wrong. Please try again.', kind: 'err' });
  }, []);

  const clearToast = useCallback(() => setToast(EMPTY), []);

  return { toast, showToast, showError, clearToast };
}
