// pull-to-refresh.tsx — the ONE pull-to-refresh in the app.
//
// Every screen refreshes the same way and from the same place: the spinner is always owned by
// `Screen`, so it always drops from directly under the violet header, and it always looks the
// same because this module builds the only RefreshControl there is.
//
// A screen declares it once, on Screen:
//
//   <Screen role="student" refreshing={loading} onRefresh={refetch}>
//
// Scrolling screens (`scroll` default) get it on Screen's own ScrollView. Screens that own their
// scrolling (`scroll={false}`, i.e. the ones built on AppList) cannot host a RefreshControl on a
// plain View, so Screen hands the very same descriptor down through this context and AppList
// attaches it to its FlatList. Either way there is one declaration, one spinner, one origin.
import { createContext, useContext, type ReactElement } from "react";
import { RefreshControl } from "react-native";

import { C } from "@/shared/constants/studia-colors";

/** What a screen asked for: whether the spinner turns, and what a pull runs. */
export type PullToRefresh = { refreshing: boolean; onRefresh: () => void };

const COLORS = [C.primary];

/** The only RefreshControl in the app. `null` means this screen has no pull-to-refresh. */
export function refreshControlFor(pull: PullToRefresh | null): ReactElement | undefined {
  if (!pull) return undefined;
  return (
    <RefreshControl
      refreshing={pull.refreshing}
      onRefresh={pull.onRefresh}
      colors={COLORS}
      tintColor={C.primary}
    />
  );
}

const PullToRefreshContext = createContext<PullToRefresh | null>(null);

/** Set by Screen only. */
export const PullToRefreshProvider = PullToRefreshContext.Provider;

/** Read by the scroller that a `scroll={false}` screen owns (AppList). */
export function useScreenPullToRefresh(): PullToRefresh | null {
  return useContext(PullToRefreshContext);
}
