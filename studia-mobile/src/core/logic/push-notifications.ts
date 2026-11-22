// push-notifications.ts: device push for the Alerts feed.
//   - once signed in (remote mode, real device, dev/production build) the app asks for permission,
//     gets an Expo push token and registers it with the server (register_push_token RPC)
//   - the server (send-push Edge Function) pushes every new `notifications` row to that token
//   - tapping a push opens the Alerts tab
//   - signOut() calls unregisterPushToken() so the next account on this phone does not get the push
// Mounted once in the root layout. A no-op in mock mode, in Expo Go and on simulators.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { isRemote } from "@/core/config/data-source";
import { getUser, useUser } from "@/core/data/storage/session-store";
import { supabaseConfigured } from "@/core/data/supabase/client";
import { db, mustOk } from "@/core/data/supabase/remote";
import { reportError } from "@/core/logic/report-error";

// Show pushes that arrive while the app is open (the Alerts feed also refreshes over Realtime).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators have no push token

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Studia",
      importance: AndroidImportance.HIGH,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

async function registerPushToken(): Promise<void> {
  const token = await getPushToken();
  if (!token) return;
  mustOk(await db().rpc("register_push_token", { p_token: token, p_platform: Platform.OS === "ios" ? "ios" : "android" }));
  registeredToken = token;
}

/** Detaches this phone from the signed-in account. Never throws: sign-out must always finish. */
export async function unregisterPushToken(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token || !isRemote) return;
  try {
    mustOk(await db().rpc("unregister_push_token", { p_token: token }));
  } catch (e) {
    reportError(e, { scope: "push.unregister" });
  }
}

export function usePushNotifications(): void {
  const router = useRouter();
  const user = useUser();
  const role = user?.role;
  const enabled = isRemote && supabaseConfigured && !!role;

  useEffect(() => {
    if (!enabled) return;
    registerPushToken().catch((e) => reportError(e, { scope: "push.register" }));
  }, [enabled, role]);

  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!last || !enabled) return;
    if (last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const current = getUser();
    if (current) router.push(`/${current.role}/notifications`);
  }, [last, enabled, router]);
}
