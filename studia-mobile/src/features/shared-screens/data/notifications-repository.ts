// notifications-repository.ts — one feed per user. Rows are created by database triggers
// (new announcement, assignment, quiz, grade, ...); the owner may only mark them read.
import type { Result } from "@/core/data/errors/app-error";
import type { Role } from "@/core/types/role";
import { RemoteNotificationRepository } from "@/features/shared-screens/data/notifications-remote";
import type { NotificationItem } from "@/features/shared-screens/types/shared-screens";

export interface NotificationRepository {
  listByRole(role: Role): Promise<Result<NotificationItem[]>>;
  markRead(role: Role, id: string): Promise<Result<void>>;
  markAllRead(role: Role): Promise<Result<void>>;
}

export const notificationRepository: NotificationRepository = new RemoteNotificationRepository();
