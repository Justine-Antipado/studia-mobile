// screen.tsx — header + content wrapper used by EVERY screen.
// Responsibilities: app header, offline banner, safe scroll area, keyboard-safe content,
// pull-to-refresh, centered max-width content on tablets, and an ErrorBoundary around the body.
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRoleUser } from "@/core/data/storage/session-store";
import type { Role } from "@/core/types/role";
import { AppHeader } from "@/shared/components/ui/app-header";
import { ErrorBoundary } from "@/shared/components/ui/error-boundary";
import { OfflineBanner } from "@/shared/components/ui/offline-banner";
import { C } from "@/shared/constants/studia-colors";
import { SPACE } from "@/shared/constants/tokens";
import { MAX_CONTENT_WIDTH, useResponsive } from "@/shared/hooks/use-responsive";

type Props = {
  role: Role;
  /** false for screens that own their scrolling (FlatList, chat, video player). */
  scroll?: boolean;
  /** Hide the app header (full-bleed screens such as quiz taking). */
  header?: boolean;
  /** Pull-to-refresh (scroll screens only). */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Label used in crash reports for this screen. */
  scope?: string;
  /** Hide the offline banner (screens that show their own connectivity state). */
  offlineBanner?: boolean;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  role,
  scroll = true,
  header = true,
  refreshing,
  onRefresh,
  scope,
  offlineBanner = true,
  children,
  contentStyle,
}: Props) {
  const user = useRoleUser(role);
  const { isTablet } = useResponsive();
  const insets = useSafeAreaInsets();
  const inner: StyleProp<ViewStyle> = [s.inner, { maxWidth: isTablet ? MAX_CONTENT_WIDTH : 640 }];
  // Sub pages are pushed over the tab bar, so nothing else keeps their last row clear of the
  // home indicator / gesture bar. Inside a tab screen the navigator has already consumed the
  // bottom inset, so this adds nothing there.
  const safeBottom = { paddingBottom: SPACE.xl + insets.bottom };

  const body = (
    <ErrorBoundary scope={scope ?? role}>
      {/* One banner for the whole app: it renders nothing while online. */}
      {offlineBanner ? <OfflineBanner /> : null}
      {children}
    </ErrorBoundary>
  );

  return (
    <View style={s.root}>
      {/* Header sits above the scroll area so content never slides over it. */}
      {header && user ? (
        <View style={s.header}>
          <AppHeader user={user} />
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={s.body}
        behavior="padding"
      >
        {scroll ? (
          <ScrollView
            style={s.flex}
            contentContainerStyle={[s.content, safeBottom, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces={!!onRefresh}
            alwaysBounceVertical={false}
            overScrollMode={onRefresh ? "always" : "never"}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  colors={[C.primary]}
                  tintColor={C.primary}
                />
              ) : undefined
            }
          >
            <View style={inner}>{body}</View>
          </ScrollView>
        ) : (
          <View style={[s.flex, s.fixed, safeBottom, contentStyle]}>
            <View style={[s.flex, inner]}>{body}</View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  header: { zIndex: 10, elevation: 10 },
  // overflow hidden = nothing can draw outside the scroll area, even during overscroll
  body: { flex: 1, overflow: "hidden", zIndex: 0 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.xl,
    flexGrow: 1,
  },
  fixed: { paddingHorizontal: 18, paddingTop: SPACE.md + 2, paddingBottom: SPACE.md },
  // keeps layout readable on tablets / wide screens
  inner: { width: "100%", alignSelf: "center", gap: SPACE.md + 2 },
});
