// shared-screens.ts — domain types for the role-aware screens shared by student and instructor
// (AI assistant, notifications, account). Repositories return these; screens never invent shapes.
import type { IconName } from "@/shared/components/ui/icon";
import type { Tone } from "@/shared/constants/studia-colors";

export type NotificationTag = "Notice" | "Quiz" | "Grade" | "Lesson" | "Class" | "AI" | "Reminder";

export type NotificationItem = {
  id: string;
  icon: IconName;
  title: string;
  meta: string;
  time: string;
  unread: boolean;
  tone: Tone;
  tag: NotificationTag;
};
