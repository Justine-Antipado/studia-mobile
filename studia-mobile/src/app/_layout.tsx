// app/_layout.tsx — root layout: Poppins loaded behind the splash screen (no font flicker),
// one ErrorBoundary around the whole app, Toast host, and the root Stack transitions.
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";

import { queryCache } from "@/core/data/cache/query-cache";
import { STACK_ROOT, STACK_SUBPAGE, useScreenAnimation } from "@/core/config/transitions";
import { sessionReady } from "@/features/auth/data/auth-service";
import { useLiveUpdates } from "@/core/logic/live-updates";
import { reportError } from "@/core/logic/report-error";
import { ErrorBoundary } from "@/shared/components/ui/error-boundary";
import { ToastProvider } from "@/shared/components/ui/toast";

SplashScreen.preventAutoHideAsync();

// Logo and mascot are bundled statically (required in the components that use them), so they are
// available offline and need no fetch. P1b adds expo-asset preloading here if needed.

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const [sessionLoaded, setSessionLoaded] = useState(false);
  useEffect(() => {
    void sessionReady.then(() => setSessionLoaded(true));
  }, []);

  useLiveUpdates();

  const ready = (fontsLoaded || !!fontError) && sessionLoaded;

  useEffect(() => {
    if (fontError) reportError(fontError, { scope: "root-layout.useFonts" });
    if (ready) void SplashScreen.hideAsync();
  }, [ready, fontError]);

  // A crash is often a bad cached payload, so "Try again" refetches from scratch.
  const onReset = useCallback(() => queryCache.clear(), []);

  // Both honour the OS "reduce motion" setting.
  const root = useScreenAnimation(STACK_ROOT);
  const subpage = useScreenAnimation(STACK_SUBPAGE);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary scope="root" onReset={onReset}>
        <ToastProvider>
          <Stack screenOptions={root}>
            <Stack.Screen name="index" />
            <Stack.Screen name="learn-more" options={subpage} />
            <Stack.Screen name="explore" options={subpage} />
            <Stack.Screen name="auth" options={subpage} />

            <Stack.Screen name="student" />
            <Stack.Screen name="instructor" />
          </Stack>
        </ToastProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
