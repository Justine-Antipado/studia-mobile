// notification-toasts.tsx — turns an incoming notification into a toast.
// Mounted once, inside ToastProvider (app/_layout.tsx). It renders nothing itself.
//
// Split of duties for B1:
//   app in the foreground -> this toast (the OS banner is suppressed, see core/logic/push-notifications)
//   app in the background -> the OS push notification
import { useEffect } from "react";

import {
  NOTIFICATION_ICONS,
  subscribeNotifications,
  type IncomingNotification,
} from "@/core/logic/notification-stream";
import { useToast } from "@/shared/components/ui/toast";

const toneFor = (n: IncomingNotification) => {
  switch (n.kind) {
    case "grade":
      return "green" as const;
    case "reminder":
    case "quiz":
      return "orange" as const;
    default:
      return "primary" as const;
  }
};

export function NotificationToasts() {
  const toast = useToast();

  useEffect(
    () =>
      subscribeNotifications((n) => {
        toast.show(n.body ? `${n.title} — ${n.body}` : n.title, {
          tone: toneFor(n),
          icon: NOTIFICATION_ICONS[n.kind],
          durationMs: 5000,
        });
      }),
    [toast],
  );

  return null;
}
