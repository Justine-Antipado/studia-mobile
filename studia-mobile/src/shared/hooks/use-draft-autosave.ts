// use-draft-autosave.ts — generic local draft for forms (quiz editor, assignment submission,
// announcement composer). Autosaves on change, restores on reopen, clears on confirm/submit.
// Never used for tokens/sessions — those belong in expo-secure-store, not here.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "studia:draft:";

export function useDraftAutosave<T>(draftId: string, initial: T, delayMs = 500) {
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = `${PREFIX}${draftId}`;

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled || !raw) return;
        setValue(JSON.parse(raw) as T);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRestored(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
      }, delayMs);
    },
    [key, delayMs],
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void AsyncStorage.removeItem(key).catch(() => {});
  }, [key]);

  return { value, update, clear, restored };
}
