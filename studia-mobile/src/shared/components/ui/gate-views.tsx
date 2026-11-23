// gate-views.tsx: what the user sees when the admin has put the app, a role or a feature under
// maintenance, or when this installed version is too old (docs: core/logic/maintenance.ts).
//   AppGate           root: whole-app blocks (maintenance "all" / "roles", update "all"), full screen
//   RouteFeatureGate  rendered by Screen INSIDE the content area: the header, the offline banner
//                     and the tab bar stay usable, only the feature's content is replaced (B3)
//   FeatureGate       inline: blocks one tab or panel inside a screen
//
// B4: one themed card for all three — a soft lavender medallion, friendly copy, the admin's own
// message, when it is expected back, and the actions that make sense for the kind of block.
import { usePathname, router } from "expo-router";
import type { ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUser } from "@/core/data/storage/session-store";
import { INSTALLED_VERSION, refreshAppStatus } from "@/core/logic/app-status";
import { FEATURE_LABELS, featureForPath, type Gate, type MaintenanceFeature } from "@/core/logic/maintenance";
import { useGate } from "@/core/logic/use-gate";
import { AppButton } from "@/shared/components/ui/app-button";
import { Icon } from "@/shared/components/ui/icon";
import { C, TONES } from "@/shared/constants/studia-colors";
import { RADIUS, SHADOW, SPACE, TYPE } from "@/shared/constants/tokens";

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;

/** Concentric tinted circles behind the icon: the theme's own shapes, no new asset to ship. */
function Medallion({ icon, tone }: { icon: "construct-outline" | "cloud-download-outline"; tone: "primary" | "gold" }) {
  const set = TONES[tone];
  return (
    <View style={[s.halo, { backgroundColor: set.bg }]}>
      <View style={[s.ring, { borderColor: set.border }]}>
        <Icon name={icon} size={34} color={set.fg} />
      </View>
    </View>
  );
}

function GateCard({ gate, onHome, compact = false }: { gate: Gate; onHome?: () => void; compact?: boolean }) {
  const isUpdate = gate.kind === "update";
  const label = gate.feature ? FEATURE_LABELS[gate.feature] : null;
  const back = when(gate.endsAt);

  const title = isUpdate
    ? "Time for a quick update"
    : label
      ? `${label} is taking a short break`
      : "Studia is taking a short break";

  const lead = isUpdate
    ? "This version is no longer supported. Install the latest one to keep going."
    : label
      ? "The rest of the app keeps working while we tidy this part up."
      : "We are improving a few things. Please check back in a little while.";

  return (
    <View style={[s.card, compact && s.cardCompact]}>
      <Medallion icon={isUpdate ? "cloud-download-outline" : "construct-outline"} tone={isUpdate ? "gold" : "primary"} />

      <Text style={[TYPE.h1, s.center]}>{title}</Text>
      <Text style={[TYPE.muted, s.center]}>{lead}</Text>

      {/* The admin's own words (Settings > System), kept visually apart from our copy. */}
      {gate.message ? (
        <View style={s.quote}>
          <Icon name="chatbubble-ellipses-outline" size="sm" color={C.primary} />
          <Text style={[TYPE.body, s.quoteText]}>{gate.message}</Text>
        </View>
      ) : null}

      {isUpdate ? (
        <Text style={[TYPE.caption, s.center]}>
          {`You have version ${INSTALLED_VERSION}${gate.minVersion ? ` · version ${gate.minVersion} or newer is required` : ""}`}
        </Text>
      ) : back ? (
        <View style={s.when}>
          <Icon name="time-outline" size="sm" color={C.muted} />
          <Text style={TYPE.caption}>{`Expected back around ${back}`}</Text>
        </View>
      ) : null}

      <View style={s.actions}>
        {isUpdate && gate.downloadUrl ? (
          <AppButton label="Get the new version" onPress={() => void Linking.openURL(gate.downloadUrl!)} />
        ) : null}
        {isUpdate && !gate.downloadUrl ? (
          <Text style={[TYPE.caption, s.center]}>Ask your campus administrator where to get the new version.</Text>
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
      <GateCard gate={gate} />
    </View>
  );
}

/**
 * Blocks the CONTENT of the current route when its feature is blocked. Rendered by Screen inside
 * the scroll/content area, so the header, the offline banner and the tab bar stay available — it
 * used to be an absoluteFill overlay in the role layout, which covered both (B3).
 * Returns null when nothing is blocked.
 */
export function RouteFeatureGate() {
  const pathname = usePathname();
  const user = useUser();
  const feature = featureForPath(pathname);
  const gate = useGate(feature);
  if (!feature || !gate) return null;
  const home = user?.role === "instructor" ? "/instructor/home" : "/student/home";
  return <GateCard gate={gate} compact onHome={() => router.replace(home)} />;
}

/** True when the current route's feature is blocked: lets Screen skip rendering its children. */
export function useRouteFeatureBlocked(): boolean {
  const pathname = usePathname();
  const gate = useGate(featureForPath(pathname));
  return !!gate?.feature;
}

/** Blocks one tab or panel inside a screen; the rest of the screen keeps working. */
export function FeatureGate({ feature, children }: { feature: MaintenanceFeature; children: ReactNode }) {
  const gate = useGate(feature);
  if (!gate) return <>{children}</>;
  return <GateCard gate={gate} compact />;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surface, justifyContent: "center", padding: SPACE.lg },
  card: {
    alignItems: "center",
    gap: SPACE.sm,
    padding: SPACE.xl,
    borderRadius: RADIUS.xxl,
    backgroundColor: C.white,
    ...SHADOW.card,
  },
  cardCompact: { padding: SPACE.lg, gap: SPACE.sm, borderRadius: RADIUS.xl },
  halo: {
    width: 104,
    height: 104,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.xs,
  },
  ring: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  quote: {
    flexDirection: "row",
    gap: SPACE.sm,
    alignSelf: "stretch",
    padding: SPACE.md,
    marginTop: SPACE.xs,
    borderRadius: RADIUS.lg,
    backgroundColor: C.lavenderSoft,
  },
  quoteText: { flex: 1 },
  when: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, marginTop: SPACE.xs },
  actions: { alignSelf: "stretch", gap: SPACE.sm, marginTop: SPACE.md },
});
