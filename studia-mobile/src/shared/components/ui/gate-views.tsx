// gate-views.tsx: what the user sees when the admin has put the app, a role or a feature under
// maintenance, or when this installed version is too old (docs: core/logic/maintenance.ts).
//   AppGate          root: whole-app blocks (maintenance "all" / "roles", update "all"), full screen
//   RouteFeatureGate role layouts: blocks the current route when its feature is blocked
//   FeatureGate      inline: blocks one tab or panel inside a screen
import { usePathname, router } from "expo-router";
import type { ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUser } from "@/core/data/storage/session-store";
import { INSTALLED_VERSION, refreshAppStatus } from "@/core/logic/app-status";
import { FEATURE_LABELS, featureForPath, type Gate, type MaintenanceFeature } from "@/core/logic/maintenance";
import { useGate } from "@/core/logic/use-gate";
import { AppButton } from "@/shared/components/ui/app-button";
import { IconTile } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;

function GateBody({ gate, onHome }: { gate: Gate; onHome?: () => void }) {
  const isUpdate = gate.kind === "update";
  const label = gate.feature ? FEATURE_LABELS[gate.feature] : null;
  const back = when(gate.endsAt);

  const title = isUpdate
    ? "Please download the latest version"
    : label
      ? `${label} is under maintenance`
      : "Studia is under maintenance";

  return (
    <View style={s.box}>
      <IconTile name={isUpdate ? "cloud-download-outline" : "construct-outline"} size={64} />
      <Text style={[TYPE.h1, s.center]}>{title}</Text>
      <Text style={[TYPE.body, s.center]}>{gate.message}</Text>
      {isUpdate ? (
        <Text style={[TYPE.muted, s.center]}>
          {`You have version ${INSTALLED_VERSION}${gate.minVersion ? `; version ${gate.minVersion} or newer is required` : ""}.`}
        </Text>
      ) : back ? (
        <Text style={[TYPE.muted, s.center]}>{`Expected back: ${back}`}</Text>
      ) : null}
      <View style={s.actions}>
        {isUpdate && gate.downloadUrl ? (
          <AppButton label="Download the new version" onPress={() => void Linking.openURL(gate.downloadUrl!)} />
        ) : null}
        {isUpdate && !gate.downloadUrl ? (
          <Text style={[TYPE.muted, s.center]}>Ask your campus administrator where to get the new version.</Text>
        ) : null}
        {!isUpdate ? <AppButton label="Check again" variant="secondary" onPress={() => void refreshAppStatus()} /> : null}
        {onHome ? <AppButton label="Back to Home" variant="secondary" onPress={onHome} /> : null}
      </View>
    </View>
  );
}

/** Whole-app block. Wraps the navigator in the root layout. */
export function AppGate({ children }: { children: ReactNode }) {
  const gate = useGate();
  const insets = useSafeAreaInsets();
  if (!gate) return <>{children}</>;
  return (
    <View style={[s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <GateBody gate={gate} />
    </View>
  );
}

/** Covers a role group's screens when the current route belongs to a blocked feature. */
export function RouteFeatureGate() {
  const pathname = usePathname();
  const user = useUser();
  const feature = featureForPath(pathname);
  const gate = useGate(feature);
  const insets = useSafeAreaInsets();
  if (!feature || !gate) return null;
  const home = user?.role === "instructor" ? "/instructor/home" : "/student/home";
  return (
    <View style={[StyleSheet.absoluteFill, s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <GateBody gate={gate} onHome={() => router.replace(home)} />
    </View>
  );
}

/** Blocks one tab or panel inside a screen; the rest of the screen keeps working. */
export function FeatureGate({ feature, children }: { feature: MaintenanceFeature; children: ReactNode }) {
  const gate = useGate(feature);
  if (!gate) return <>{children}</>;
  return <GateBody gate={gate} />;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surface, justifyContent: "center" },
  box: { alignItems: "center", gap: SPACE.md, padding: SPACE.xl },
  center: { textAlign: "center" },
  actions: { alignSelf: "stretch", gap: SPACE.sm, marginTop: SPACE.sm },
});
