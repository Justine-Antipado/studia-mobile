// notification-stream.ts — the one channel for "a notification just arrived for me".
//
// Why it exists: the Realtime subscription in live-updates.ts used to only drop the caches, so a
// new announcement, task, quiz or grade appeared on the Alerts screen but nothing told the user
// while they were looking at another screen (B1). A row INSERT is published here; the toaster
// mounted inside ToastProvider renders it. Keeping the store outside React lets the data layer
// publish without importing a hook, and lets the UI decide how to present it.
import type { IconName } from "@/shared/components/ui/icon";

/** The notification kinds the database can produce (public.notification_kind, migration 005). */
export type NotificationKind = "notice" | "class" | "reminder" | "quiz" | "lesson" | "grade";

export type IncomingNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
};

const KINDS: readonly NotificationKind[] = ["notice", "class", "reminder", "quiz", "lesson", "grade"];

/** Icon per kind, shared by the in-app toast and the Alerts list. */
export const NOTIFICATION_ICONS: Record<NotificationKind, IconName> = {
  notice: "megaphone-outline",
  class: "people-outline",
  reminder: "alarm-outline",
  quiz: "help-circle-outline",
  lesson: "book-outline",
  grade: "ribbon-outline",
};

/** Realtime hands us `unknown`: validate before anything is shown (no unchecked casts). */
export function toIncoming(raw: unknown): IncomingNotification | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const { id, kind, title, body } = r;
  if (typeof id !== "string" || typeof title !== "string" || title.length === 0) return null;
  if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) return null;
  return { id, kind: kind as NotificationKind, title, body: typeof body === "string" ? body : "" };
}

type Listener = (n: IncomingNotification) => void;

const listeners = new Set<Listener>();
/** Ids already announced, so a Realtime replay or a second subscription cannot double-toast. */
const seen = new Set<string>();
const SEEN_LIMIT = 50;

export function publishNotification(n: IncomingNotification): void {
  if (seen.has(n.id)) return;
  seen.add(n.id);
  if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value as string);
  listeners.forEach((l) => l(n));
}

export function subscribeNotifications(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Sign-out clears it: the next account on this phone must not see the previous one's ids. */
export function resetNotificationStream(): void {
  seen.clear();
}
