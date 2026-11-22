import type { Role } from "@/core/types/role";

/**
 * MAINTENANCE GATE — the student/instructor side of the admin's Settings →
 * System window. The admin writes the document (see
 * `studia-admin/src/core/logic/maintenance.js` and the `system.maintenance`
 * row in `docs/api-contract.md`); this module answers the one question a
 * screen or a request needs:
 *
 *   if (isUnderMaintenance(config, user, "ai.chat")) { show the notice }
 *
 * The server enforces the same rule and answers 503 — this is for telling the
 * user why, not for security.
 */
export type MaintenanceScope = "all" | "roles" | "features";

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

export type MaintenanceConfig = {
  enabled: boolean;
  scope: MaintenanceScope;
  roles: Role[];
  features: MaintenanceFeature[];
  /** Shown to the affected user; empty means "use the app's default wording". */
  message: string;
  /** ISO strings. Empty or null means "right away" / "until turned off". */
  startsAt?: string | null;
  endsAt?: string | null;
};

export const NO_MAINTENANCE: MaintenanceConfig = {
  enabled: false,
  scope: "all",
  roles: [],
  features: [],
  message: "",
  startsAt: null,
  endsAt: null,
};

const atMs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
};

/** Enabled, already started and not yet finished. */
export function isMaintenanceWindowOpen(
  config: MaintenanceConfig | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!config?.enabled) return false;
  const starts = atMs(config.startsAt);
  const ends = atMs(config.endsAt);
  if (starts !== null && now < starts) return false;
  if (ends !== null && now >= ends) return false;
  return true;
}

/**
 * Is this user shut out — of the whole app when `feature` is omitted, or of
 * that one module when it is given?
 */
export function isUnderMaintenance(
  config: MaintenanceConfig | null | undefined,
  user: { role: Role } | null | undefined,
  feature?: MaintenanceFeature,
  now: number = Date.now(),
): boolean {
  if (!isMaintenanceWindowOpen(config, now) || !config) return false;

  const role: Role = user?.role ?? "student";
  if (config.scope === "all") return true;
  if (config.scope === "roles") return config.roles.includes(role);
  return !!feature && config.features.includes(feature);
}

/** The line to show the user, with a sensible default when the admin left the message empty. */
export function maintenanceMessage(config: MaintenanceConfig | null | undefined): string {
  const custom = config?.message?.trim();
  if (custom) return custom;
  return "Studia is under maintenance right now. Please try again later.";
}
