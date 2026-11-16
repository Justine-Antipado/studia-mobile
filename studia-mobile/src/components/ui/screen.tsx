// components/ui/screen.tsx  (header + content wrapper used by every tab screen)
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { AppHeader } from "@/components/ui/app-header";
import { C } from "@/constants/studia-colors";
import { useRoleUser } from "@/lib/session-store";
import type { Role } from "@/services/auth-service";

type Props = {
  role: Role;
  scroll?: boolean;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ role, scroll = true, children, contentStyle }: Props) {
  const user = useRoleUser(role);
  return (
    <View style={s.root}>
      {user ? <AppHeader user={user} /> : null}
      {scroll ? (
        <ScrollView
          style={s.flex}
          contentContainerStyle={[s.content, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[s.flex, s.fixed, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  flex: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, gap: 14 },
  fixed: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 },
});