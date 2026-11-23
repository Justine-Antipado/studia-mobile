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

import { cacheReady, queryCache } from "@/core/data/cache/query-cache";
import { deviceFlagsReady } from "@/core/data/storage/device-flags";
import {
  STACK_ROLE_GROUP,
  STACK_ROOT,
  STACK_SUBPAGE,
  useScreenAnimation,
} from "@/core/config/transitions";
import { appStatusReady, useAppStatusSync } from "@/core/logic/app-status";
import { sessionReady } from "@/features/auth/data/auth-service";
import { useLiveUpdates } from "@/core/logic/live-updates";
import { usePushNotifications } from "@/core/logic/push-notifications";
import { reportError } from "@/core/logic/report-error";
import { AppGate } from "@/shared/components/ui/gate-views";
import { ErrorBoundary } from "@/shared/components/ui/error-boundary";
import { NotificationToasts } from "@/shared/components/ui/notification-toasts";
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
    // The splash also waits (at most a few seconds) for the maintenance status, so a closed app never flashes open.
    void Promise.all([sessionReady, appStatusReady, cacheReady, deviceFlagsReady]).then(() =>
      setSessionLoaded(true),
    );
  }, []);

  useAppStatusSync();
  useLiveUpdates();
  usePushNotifications();

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
  const roleGroup = useScreenAnimation(STACK_ROLE_GROUP);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary scope="root" onReset={onReset}>
        <ToastProvider>
          {/* Announces a Realtime notification in-app; must sit inside ToastProvider. */}
          <NotificationToasts />
          <AppGate>
          <Stack screenOptions={root}>
            <Stack.Screen name="index" />
            <Stack.Screen name="learn-more" options={subpage} />
            <Stack.Screen name="explore" options={subpage} />
            <Stack.Screen name="auth" options={subpage} />

            <Stack.Screen name="student" options={roleGroup} />
            <Stack.Screen name="instructor" options={roleGroup} />
          </Stack>
          </AppGate>
        </ToastProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
