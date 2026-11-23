// use-gate.ts: "is this screen blocked right now, and why?" for the current user and app version.
import { useUser } from "@/core/data/storage/session-store";
import { INSTALLED_VERSION, useAppStatus } from "@/core/logic/app-status";
import { gateFor, type Gate, type MaintenanceFeature } from "@/core/logic/maintenance";

export function useGate(feature?: MaintenanceFeature): Gate | null {
  const status = useAppStatus();
  const user = useUser();
  return gateFor(status, user?.role ?? null, INSTALLED_VERSION, feature);
}
