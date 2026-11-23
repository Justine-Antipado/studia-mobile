import type { Role } from "@/core/types/role";

/**
 * MAINTENANCE + REQUIRED-UPDATE GATE — the phone side of the admin's Settings → System page.
 *
 * The admin writes two documents (settings.system.maintenance and settings.system.update). The phone
 * reads them through the public `app_status()` database function (see app-status.ts), which already
 * evaluates the maintenance window against the server clock. This module answers one question for one
 * screen:
 *
 *   gateFor(status, role, installedVersion, "ai.chat") -> null | { kind, message, ... }
 *
 *  - maintenance scope "all"      -> every user, even before sign-in
 *  - maintenance scope "roles"    -> the chosen roles, once signed in
 *  - maintenance scope "features" -> only those features AND their sub features (see SUB_FEATURES)
 *  - required update              -> installed app older than `minVersion`: the whole app ("all") or
 *                                    just the chosen features (and their sub features) stop working and
 *                                    the user is asked to download the new version
 *
 * This is for telling the user why; it is not a security boundary (a modified client can ignore it).
 */
export type MaintenanceFeature =
  | "classes"
  | "content"
  | "assessments"
  | "announcements"
  | "ai.summarizer"
  | "ai.planner"
  | "ai.quiz"
  | "ai.chat"
  | "reports"
  | "notifications";

export const FEATURE_LABELS: Record<MaintenanceFeature, string> = {
  classes: "Classes",
  content: "Lessons and materials",
  assessments: "Assignments and quizzes",
  announcements: "Class announcements",
  "ai.summarizer": "AI summarizer",
  "ai.planner": "Study planner",
  "ai.quiz": "AI quiz generator",
  "ai.chat": "AI assistant",
  reports: "Analytics",
  notifications: "Alerts",
};

/** Turning a feature off also turns off everything that lives inside it. */
export const SUB_FEATURES: Partial<Record<MaintenanceFeature, MaintenanceFeature[]>> = {
  classes: ["content", "assessments", "announcements"],
};

const expand = (features: readonly MaintenanceFeature[]): Set<MaintenanceFeature> => {
  const out = new Set<MaintenanceFeature>(features);
  for (const f of features) SUB_FEATURES[f]?.forEach((child) => out.add(child));
  return out;
};

export type AppStatus = {
  maintenance: {
    active: boolean;
    scope: "all" | "roles" | "features";
    roles: Role[];
    features: MaintenanceFeature[];
    message: string;
    endsAt: string | null;
  };
  update: {
    required: boolean;
    minVersion: string;
    scope: "all" | "features";
    features: MaintenanceFeature[];
    downloadUrl: string;
    message: string;
  };
  legal: { terms: string; privacy: string; updatedAt: string | null };
};

export type Gate = {
  kind: "maintenance" | "update";
  /** Set when only one feature is blocked; absent when the whole app is. */
  feature?: MaintenanceFeature;
  message: string;
  endsAt?: string | null;
  downloadUrl?: string;
  minVersion?: string;
};

/** 1 when a > b, -1 when a < b, 0 when equal. Non-numeric parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function maintenanceMessage(custom: string | undefined, feature?: MaintenanceFeature): string {
  const text = custom?.trim();
  if (text) return text;
  return feature
    ? `${FEATURE_LABELS[feature]} is under maintenance right now. Please try again later.`
    : "Studia is under maintenance right now. Please try again later.";
}

export function updateMessage(custom: string | undefined, feature?: MaintenanceFeature): string {
  const text = custom?.trim();
  if (text) return text;
  return feature
    ? `${FEATURE_LABELS[feature]} needs the latest version of Studia. Please download the new version to keep using it.`
    : "A new version of Studia is required. Please download the latest version to continue.";
}

/**
 * Is this user shut out of the whole app (`feature` omitted) or of one feature?
 * A whole-app block also blocks every feature. `status` null (not loaded / offline) never blocks.
 */
export function gateFor(
  status: AppStatus | null | undefined,
  role: Role | null | undefined,
  installedVersion: string,
  feature?: MaintenanceFeature,
): Gate | null {
  if (!status) return null;

  const m = status.maintenance;
  if (m.active) {
    const wholeApp = m.scope === "all" || (m.scope === "roles" && !!role && m.roles.includes(role));
    if (wholeApp) {
      return { kind: "maintenance", message: maintenanceMessage(m.message), endsAt: m.endsAt };
    }
    if (m.scope === "features" && feature && expand(m.features).has(feature)) {
      return { kind: "maintenance", feature, message: maintenanceMessage(m.message, feature), endsAt: m.endsAt };
    }
  }

  const u = status.update;
  if (u.required && u.minVersion && compareVersions(installedVersion, u.minVersion) < 0) {
    const base = { kind: "update" as const, downloadUrl: u.downloadUrl, minVersion: u.minVersion };
    if (u.scope === "all") return { ...base, message: updateMessage(u.message) };
    if (feature && expand(u.features).has(feature)) {
      return { ...base, feature, message: updateMessage(u.message, feature) };
    }
  }
  return null;
}

/** Which feature a screen belongs to, from its route. Undefined = never blocked by a feature rule. */
const BY_SCREEN: Record<string, MaintenanceFeature> = {
  // classes and everything you do inside one
  courses: "classes",
  classes: "classes",
  "course-detail": "classes",
  "class-detail": "classes",
  "join-class": "classes",
  "create-class": "classes",
  "student-detail": "classes",
  // lessons
  "lesson-viewer": "content",
  "material-detail": "content",
  "upload-material": "content",
  // assignments and quizzes
  todo: "assessments",
  assessments: "assessments",
  "assignment-detail": "assessments",
  "quiz-take": "assessments",
  "quiz-result": "assessments",
  "quiz-detail": "assessments",
  "create-assignment": "assessments",
  "edit-assignment": "assessments",
  "create-quiz": "assessments",
  "edit-quiz": "assessments",
  "grade-assignment": "assessments",
  "grade-submission": "assessments",
  grading: "assessments",
  gradebook: "assessments",
  // announcements
  "announcement-detail": "announcements",
  "post-announcement": "announcements",
  // AI
  ai: "ai.chat",
  planner: "ai.planner",
  "ai-quiz": "ai.quiz",
  // the rest
  analytics: "reports",
  notifications: "notifications",
};

export function featureForPath(pathname: string): MaintenanceFeature | undefined {
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  return BY_SCREEN[last];
}
