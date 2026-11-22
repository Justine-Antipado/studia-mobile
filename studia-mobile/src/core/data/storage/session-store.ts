// lib/session-store.ts
// Tiny in-memory store for the logged-in user (no extra library needed).
// The Supabase session itself is persisted by core/data/supabase/secure-storage.ts (SecureStore);
// this store only holds the profile for the current run.
import { useSyncExternalStore } from "react";

import type { Role } from "@/core/types/role";

export type UserProfile = {
  role: Role;
  fullName: string;
  email: string;
  department?: string; // instructor
  course?: string; // student
  year?: string; // student
  section?: string; // student
  phone?: string;
  /** Local file URI of the profile photo (read from this device). */
  avatarUri?: string;
};

let current: UserProfile | null = null;
const listeners = new Set<() => void>();

export function setUser(user: UserProfile | null) {
  current = user;
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const snapshot = () => current;

/** Non-reactive read for data-layer code. UI uses useUser(). */
export const getUser = () => current;

export function useUser(): UserProfile | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** The signed-in user for a role screen, or null when signed out (the role guard then redirects). */
export function useRoleUser(_role: Role): UserProfile | null {
  return useUser();
}

/* ---------- display helpers ---------- */

export function initials(name: string, max = 2): string {
  const words = name
    .replace(/^(prof|dr|engr|mr|ms|mrs)\.?\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, max).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

export const displayName = (u: UserProfile) =>
  u.fullName.trim() || u.email.split("@")[0] || "User";

export const roleLabel = (u: UserProfile) => (u.role === "instructor" ? "Instructor" : "Student");

const digit = (v = "") => v.match(/\d/)?.[0] ?? v;

/** Student: "BSIT 3-A". Instructor: the department. */
export function detailLabel(u: UserProfile): string {
  if (u.role === "instructor") return u.department?.trim() ?? "";
  const sec = (u.section ?? "").trim();
  const yearSec = sec.includes("-") ? sec : [digit(u.year), sec].filter(Boolean).join("-");
  return [u.course?.trim(), yearSec].filter(Boolean).join(" ");
}

/** "Instructor · IT Department" / "Student · BSIT 3-A" */
export function tagLabel(u: UserProfile): string {
  const d = detailLabel(u);
  return d ? `${roleLabel(u)} · ${d}` : roleLabel(u);
}