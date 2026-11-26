// screen.tsx — header + content wrapper used by EVERY screen.
// Responsibilities: app header, offline banner, safe scroll area, keyboard-safe content,
// pull-to-refresh, centered max-width content on tablets, and an ErrorBoundary around the body.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { queryCache } from "@/core/data/cache/query-cache";
import { useAnyQueryFetching } from "@/core/data/repository/inflight";
import { useRoleUser } from "@/core/data/storage/session-store";
import type { Role } from "@/core/types/role";
import { AppHeader } from "@/shared/components/ui/app-header";
import { ErrorBoundary } from "@/shared/components/ui/error-boundary";
import { OfflineBanner } from "@/shared/components/ui/offline-banner";
import {
  PullToRefreshProvider,
  refreshControlFor,
  type PullToRefresh,
} from "@/shared/components/ui/pull-to-refresh";
import { C } from "@/shared/constants/studia-colors";
import { SPACE } from "@/shared/constants/tokens";
import { MAX_CONTENT_WIDTH, useResponsive } from "@/shared/hooks/use-responsive";

type Props = {
  role: Role;
  /** false for screens that own their scrolling (FlatList, chat, video player). */
  scroll?: boolean;
  /** Hide the app header (full-bleed screens such as quiz taking). */
  header?: boolean;
  /** Pull-to-refresh. Declared here for EVERY screen, scrolling or not — see pull-to-refresh.tsx. */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Label used in crash reports for this screen. */
  scope?: string;
  /** Hide the offline banner (screens that show their own connectivity state). */
  offlineBanner?: boolean;
  /**
   * This screen is one of the bottom tab screens (not pushed over the tab bar). The tab bar
   * already pads itself by the safe-area bottom inset, so with scroll={false} adding it again
   * here would shrink the fixed-height content view by that amount a second time — on a long
   * list that shows up as the last row getting cut well above the tab bar instead of running
   * down to it.
   */
  tabScreen?: boolean;
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
  tabScreen = false,
  children,
  contentStyle,
}: Props) {
  const user = useRoleUser(role);
  // Every screen can be pulled down to reload: clearing the query cache makes each mounted query
  // refetch in the background (the data on screen stays until the new data arrives). A screen that
  // passes its own onRefresh keeps it; full-bleed screens (header={false}, e.g. quiz taking) don't.
  const [pulling, setPulling] = useState(false);
  const fetching = useAnyQueryFetching();
  // The fallback spinner follows the real reload, exactly like a screen that passes its own
  // onRefresh: it stops once nothing is fetching any more. The short settle gives the refetches
  // that clearing the cache triggers time to start before "nothing is fetching" counts.
  useEffect(() => {
    if (!pulling || fetching) return;
    const settle = setTimeout(() => setPulling(false), SETTLE_MS);
    return () => clearTimeout(settle);
  }, [pulling, fetching]);
  // ...and a hard cap, so a request that never answers cannot spin forever.
  useEffect(() => {
    if (!pulling) return;
    const cap = setTimeout(() => setPulling(false), MAX_SPIN_MS);
    return () => clearTimeout(cap);
  }, [pulling]);
  const pullToReload = useCallback(() => {
    setPulling(true);
    queryCache.clear();
  }, []);
  const refresh = onRefresh ?? (header ? pullToReload : undefined);
  const spinning = onRefresh ? refreshing : pulling;
  // The single descriptor: the ScrollView below uses it directly, and a screen that owns its
  // scrolling (scroll={false}) gets the same one through the context, so both spin identically.
  const pull = useMemo<PullToRefresh | null>(
    () => (refresh ? { refreshing: !!spinning, onRefresh: refresh } : null),
    [refresh, spinning],
  );
  const { isTablet } = useResponsive();
  const insets = useSafeAreaInsets();
  const inner: StyleProp<ViewStyle> = [s.inner, { maxWidth: isTablet ? MAX_CONTENT_WIDTH : 640 }];
  // Sub pages are pushed over the tab bar, so nothing else keeps their last row clear of the
  // home indicator / gesture bar.
  const safeBottom = { paddingBottom: SPACE.xl + insets.bottom };
  // scroll={false} wraps a FlatList in a FIXED-height view, not a scrollable one: any padding
  // here shrinks the visible list area itself rather than adding scrollable space past the last
  // row, so on a tab screen (tabScreen above) it must be zero, overriding s.fixed's own — the tab
  // bar already clears itself, and the list's own contentContainerStyle padding gives the last
  // row its breathing room. Pushed sub-pages still need the full safeBottom since nothing else
  // protects their last row from the home indicator / gesture bar.
  const fixedBottom = tabScreen ? { paddingBottom: 0 } : safeBottom;

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
            bounces={!!refresh}
            alwaysBounceVertical={false}
            overScrollMode={refresh ? "always" : "never"}
            refreshControl={refreshControlFor(pull)}
          >
            <View style={inner}>{body}</View>
          </ScrollView>
        ) : (
          // The screen owns its scrolling, so its AppList picks the refresh up from here.
          <PullToRefreshProvider value={pull}>
            <View style={[s.flex, s.fixed, fixedBottom, contentStyle]}>
              <View style={[s.flex, inner]}>{body}</View>
            </View>
          </PullToRefreshProvider>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Grace period for the cache-clear refetches to register before the spinner may stop. */
const SETTLE_MS = 200;
/** withRetry can take ~3 attempts with backoff; past this the spinner gives up regardless. */
const MAX_SPIN_MS = 15_000;

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
