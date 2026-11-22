// notifications-remote.ts: the signed-in user's feed from the `notifications` table. Rows are created
// by database triggers (new announcement, assignment, quiz, grade, ...); the owner may only mark them read.
import type { Result } from "@/core/data/errors/app-error";
import { db, guard, must, myId } from "@/core/data/supabase/remote";
import type { NotificationTag } from "@/core/data/mock/mock-db";
import type { NotificationRepository } from "@/features/shared-screens/data/notifications-repository";
import type { NotificationItem } from "@/features/shared-screens/types/shared-screens";
import type { IconName } from "@/shared/components/ui/icon";
import type { Tone } from "@/shared/constants/studia-colors";

const LOOK: Record<NotificationTag, { icon: IconName; tone: Tone }> = {
  Notice: { icon: "megaphone-outline", tone: "primary" },
  Quiz: { icon: "document-text-outline", tone: "orange" },
  Grade: { icon: "bar-chart-outline", tone: "green" },
  Lesson: { icon: "book-outline", tone: "blue" },
  Class: { icon: "person-add-outline", tone: "blue" },
  AI: { icon: "sparkles-outline", tone: "primary" },
  Reminder: { icon: "calendar-outline", tone: "gold" },
};

const TAG: Record<string, NotificationTag> = {
  notice: "Notice",
  quiz: "Quiz",
  grade: "Grade",
  lesson: "Lesson",
  class: "Class",
  ai: "AI",
  reminder: "Reminder",
};

type Row = { id: string; kind: string; title: string; body: string; link_params: { meta?: string } | null; read_at: string | null; created_at: string };

function shortAge(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}d`;
}

function toItem(n: Row): NotificationItem {
  const tag = TAG[n.kind] ?? "Notice";
  return {
    id: n.id,
    icon: LOOK[tag].icon,
    tone: LOOK[tag].tone,
    tag,
    title: n.title,
    meta: n.link_params?.meta ?? "",
    body: n.body || undefined,
    time: shortAge(n.created_at),
    unread: n.read_at === null,
  };
}

export class RemoteNotificationRepository implements NotificationRepository {
  listByRole(): Promise<Result<NotificationItem[]>> {
    return guard(async () => {
      const me = await myId();
      const rows = must(
        await db().from("notifications").select("id, kind, title, body, link_params, read_at, created_at").eq("user_id", me).order("created_at", { ascending: false }).limit(100),
      ) as Row[];
      return rows.map(toItem);
    });
  }

  markRead(_role: unknown, id: string): Promise<Result<void>> {
    return guard(async () => {
      must(await db().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null));
    }, "This notification no longer exists.");
  }

  markAllRead(): Promise<Result<void>> {
    return guard(async () => {
      const me = await myId();
      must(await db().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me).is("read_at", null));
    });
  }
}
