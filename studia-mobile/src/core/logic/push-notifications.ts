// push-notifications.ts: device push for the Alerts feed.
//   - once signed in (remote mode, real device, dev/production build) the app asks for permission,
//     gets an Expo push token and registers it with the server (register_push_token RPC)
//   - the server (send-push Edge Function) pushes every new `notifications` row to that token
//   - tapping a push opens the Alerts tab
//   - signOut() calls unregisterPushToken() so the next account on this phone does not get the push
// Mounted once in the root layout. A no-op in Expo Go and on simulators.
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { getUser, useUser } from "@/core/data/storage/session-store";
import { supabaseConfigured } from "@/core/data/supabase/client";
import { db, mustOk } from "@/core/data/supabase/remote";
import { reportError } from "@/core/logic/report-error";

// While Studia is in the foreground the in-app toast announces the notification
// (shared/components/ui/notification-toasts.tsx, fed by Realtime), so the OS banner is suppressed
// to avoid showing the same thing twice. It still goes to the tray/notification list.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: AppState.currentState !== "active",
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

/**
 * Expo Go dropped remote notifications in SDK 53: on Android `addPushTokenListener` THROWS and
 * `setNotificationChannelAsync` rejects with a native NullPointerException. Nothing in this module
 * may run there — push needs a development or EAS build (docs/ROUTE-MAP.md, AGENTS.md).
 */
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Why this device has no push token, for the error sink. Push silently doing nothing was the
 * hardest part of B1 to diagnose: every dead end now reports itself once.
 */
type PushBlocker = "expo-go" | "simulator" | "permission-denied" | "no-project-id" | null;

let lastBlocker: PushBlocker = null;

function reportBlocker(blocker: Exclude<PushBlocker, null>): null {
  if (lastBlocker !== blocker) {
    lastBlocker = blocker;
    reportError(new Error(`push disabled: ${blocker}`), { scope: "push.register" });
  }
  return null;
}

async function getPushToken(): Promise<string | null> {
  if (IS_EXPO_GO) return reportBlocker("expo-go");
  if (!Device.isDevice) return reportBlocker("simulator"); // simulators have no push token

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Studia",
      importance: AndroidImportance.HIGH,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  // Only ask when the OS still allows asking; on Android 13+ a second refusal is final.
  const granted =
    current.granted ||
    (current.canAskAgain ? (await Notifications.requestPermissionsAsync()).granted : false);
  if (!granted) return reportBlocker("permission-denied");

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return reportBlocker("no-project-id");
  lastBlocker = null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

async function sendToken(token: string): Promise<void> {
  mustOk(await db().rpc("register_push_token", { p_token: token, p_platform: Platform.OS === "ios" ? "ios" : "android" }));
  registeredToken = token;
}

async function registerPushToken(): Promise<void> {
  const token = await getPushToken();
  if (!token || token === registeredToken) return;
  await sendToken(token);
}

/** Detaches this phone from the signed-in account. Never throws: sign-out must always finish. */
export async function unregisterPushToken(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
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
  // Expo Go has no remote notifications at all, so nothing below may even be subscribed there.
  const enabled = supabaseConfigured && !!role && !IS_EXPO_GO;

  // ===========================================================================================
  // ⬇️ DEV BUILD / APK: UNCOMMENT THIS WHOLE BLOCK (walang ibang kailangang baguhin).
  // Pinatay muna para matest sa Expo Go: sa Android, `addPushTokenListener` ay nag-THROW at
  // `setNotificationChannelAsync` ay nagre-reject (NullPointerException) — tinanggal ng Expo Go
  // ang remote notifications noong SDK 53. Ang in-app toast (Realtime) ay tumatakbo pa rin.
  // ===========================================================================================
  // useEffect(() => {
  //   if (!enabled) return;
  //   registerPushToken().catch((e) => reportError(e, { scope: "push.register" }));
  //
  //   // Expo can rotate the token (reinstall, restored backup, FCM refresh). Without this the
  //   // server keeps pushing to a dead token and the phone goes quiet for good.
  //   const sub = Notifications.addPushTokenListener(({ data }) => {
  //     if (typeof data !== "string" || data === registeredToken) return;
  //     sendToken(data).catch((e) => reportError(e, { scope: "push.rotate" }));
  //   });
  //
  //   // Permission can also be granted later, from Android settings: re-check on every return.
  //   const app = AppState.addEventListener("change", (state) => {
  //     if (state === "active" && !registeredToken) {
  //       registerPushToken().catch((e) => reportError(e, { scope: "push.register" }));
  //     }
  //   });
  //
  //   return () => {
  //     sub.remove();
  //     app.remove();
  //   };
  // }, [enabled, role]);
  // ======================================= END BLOCK =========================================

  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!last || !enabled) return;
    if (last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const current = getUser();
    if (current) router.push(`/${current.role}/notifications`);
  }, [last, enabled, router]);
}
