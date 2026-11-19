// toast.tsx — short non-blocking feedback ("Announcement posted", "You are offline").
// Mounted once in the root layout; screens call useToast().show(...).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/shared/components/ui/icon";
import { C, TONES, type Tone } from "@/shared/constants/studia-colors";
import { RADIUS, SHADOW, SPACE, TYPE } from "@/shared/constants/tokens";

type ToastOptions = { tone?: Tone; icon?: IconName; durationMs?: number };
type Toast = { message: string; tone: Tone; icon: IconName };

type ToastApi = { show: (message: string, options?: ToastOptions) => void; hide: () => void };

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_ICON: Record<Tone, IconName> = {
  primary: "information-circle-outline",
  blue: "information-circle-outline",
  green: "checkmark-circle-outline",
  gold: "sparkles-outline",
  orange: "alert-circle-outline",
  red: "close-circle-outline",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const hide = useCallback(() => {
    clear();
    setToast(null);
  }, [clear]);

  const show = useCallback(
    (message: string, options?: ToastOptions) => {
      const tone = options?.tone ?? "primary";
      clear();
      setToast({ message, tone, icon: options?.icon ?? DEFAULT_ICON[tone] });
      timer.current = setTimeout(() => setToast(null), options?.durationMs ?? 2600);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);

  const api = useMemo<ToastApi>(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <Animated.View
          entering={FadeInDown.duration(180)}
          exiting={FadeOutUp.duration(140)}
          pointerEvents="none"
          style={[s.wrap, { top: insets.top + SPACE.sm }]}
        >
          <View
            style={[s.toast, { backgroundColor: TONES[toast.tone].bg, borderColor: TONES[toast.tone].border }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Icon name={toast.icon} size="md" color={TONES[toast.tone].fg} />
            <Text style={[TYPE.bodyStrong, s.text, { color: TONES[toast.tone].strong }]} numberOfLines={3}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

/** Safe outside a provider (returns no-ops) so screens can be rendered in isolation. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return ctx ?? NOOP;
}

const NOOP: ToastApi = { show: () => {}, hide: () => {} };

const s = StyleSheet.create({
  wrap: { position: "absolute", left: SPACE.lg, right: SPACE.lg, alignItems: "center", zIndex: 100 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm + 2,
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.lg - 2,
    paddingVertical: SPACE.md,
    backgroundColor: C.white,
    ...SHADOW.card,
  },
  text: { flexShrink: 1 },
});
