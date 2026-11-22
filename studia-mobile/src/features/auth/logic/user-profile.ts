// user-profile.ts — maps the auth `User` (from the server) to the in-memory `UserProfile` the
// screens read. The server stores one composed section string ("BSIT 3-A"); the profile keeps
// course / year / section separately, so the Account edit form can show the right chips and
// `tagLabel` can print "Student · BSIT 3-A". Before this, course and year were dropped on login.
import type { UserProfile } from "@/core/data/storage/session-store";
import type { User } from "@/features/auth/types/auth-types";

const SECTION_RE = /^(.+?)\s+(\d)-([A-Za-z])$/;

/** "BSIT 3-A" -> { course: "BSIT", year: "3", section: "A" }; null when it has another shape. */
export function splitSection(composed: string | undefined): { course: string; year: string; section: string } | null {
  const m = composed ? SECTION_RE.exec(composed.trim()) : null;
  return m ? { course: m[1]!, year: m[2]!, section: m[3]!.toUpperCase() } : null;
}

export function toProfile(u: User): UserProfile {
  const parts = u.role === "student" ? splitSection(u.section) : null;
  return {
    role: u.role,
    fullName: u.fullName,
    email: u.email,
    department: u.department,
    phone: u.phone,
    // Unparseable legacy values are kept as-is in `section`; detailLabel still prints them.
    ...(parts ?? { section: u.section }),
  };
}
