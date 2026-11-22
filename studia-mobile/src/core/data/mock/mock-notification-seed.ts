// mock-notification-seed.ts — a few notifications that already exist when the app opens, so the
// Alerts tab is not empty on first launch. Everything after that is created by events.
import type { DbNotification } from "@/core/data/mock/mock-db";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export function seedNotifications(): DbNotification[] {
  const n = (
    id: string, userId: string, tag: DbNotification["tag"], title: string, meta: string, minAgo: number, unread: boolean, body?: string,
  ): DbNotification => ({
    id, userId, tag, title, meta, body: body ?? null, createdAt: ago(minAgo), readAt: unread ? null : ago(minAgo - 1),
  });
  return [
    n("sn1", "u_juan", "Notice", "Midterm exam schedule", "IT 321", 120, true, "Our midterm exam is on Nov 10-14, 2026. Coverage: Lessons 1-5."),
    n("sn2", "u_juan", "Quiz", "Quiz 2: Network Security is open", "IT 321", 300, true, "Due in about a day. It has an essay question that your instructor will grade."),
    n("sn3", "u_juan", "Grade", "Quiz 1 Corrections graded", "You scored 5/5", 60 * 24, false),
    n("sn4", "u_juan", "Lesson", "New lesson posted", "IT 321 · Lesson 3: Network Security Basics", 60 * 48, false),
    n("sn5", "u_maria", "Grade", "6 submissions need grading", "IT 321 · Quiz 2: Network Security", 60, true, "Six students submitted an essay answer that has to be graded by you."),
    n("sn6", "u_maria", "Class", "Students joined your classes", "IT 321 · Section BSIT 3-A", 240, true),
    n("sn7", "u_maria", "Reminder", "Midterm exam reminder", "Nov 10-14, 2026", 60 * 72, false),
  ];
}
