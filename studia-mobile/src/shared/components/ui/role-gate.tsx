// role-gate.tsx — wraps a role group layout: renders the group only for the matching role,
// and shows a neutral placeholder (never a dead end) while a redirect is in flight.
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useRoleGuard } from "@/core/logic/use-role-guard";
import type { Role } from "@/core/types/role";
import { C } from "@/shared/constants/studia-colors";

export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { allowed } = useRoleGuard(role);

  if (!allowed) {
    return (
      <View style={s.root}>
        <ActivityIndicator color={C.primary} accessibilityLabel="Loading" />
      </View>
    );
  }

  return <>{children}</>;
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.surface },
});
