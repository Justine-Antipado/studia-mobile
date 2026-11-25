// app-list.tsx — the ONE virtualized list. Every screen list goes through this instead of
// mapping an array inside a ScrollView, so the tuning (window size, batch size, recycling,
// pull-to-refresh, the row gap) is decided once.
//
// Why a wrapper: FlatList is only as fast as its props. An inline renderItem, separator or
// contentContainerStyle is a new value on every render, which re-renders every visible row and
// makes React.memo on the row components pointless. Here those props are module-level constants
// and the caller passes `renderRow`, which it wraps in its own useCallback.
//
// Pull-to-refresh is NOT a prop of this list: it comes from Screen through pull-to-refresh.tsx,
// so there is one spinner, one look, one place it is pulled from.
import { memo, useCallback, type ReactElement } from "react";
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from "react-native";

import {
  refreshControlFor,
  useScreenPullToRefresh,
} from "@/shared/components/ui/pull-to-refresh";
import { SPACE } from "@/shared/constants/tokens";

type Identifiable = { id: string };

type Props<T extends Identifiable> = {
  data: readonly T[];
  /** Wrap this in useCallback in the calling screen, or the rows re-render on every keystroke. */
  renderRow: (item: T) => ReactElement | null;
  /** Pagination: called once per end-of-list; the hook decides whether another page exists. */
  onEndReached?: () => void;
  header?: ReactElement | null;
  footer?: ReactElement | null;
  /** Only when every row really is this tall — it enables getItemLayout (no measuring pass). */
  rowHeight?: number;
  horizontal?: boolean;
};

const Separator = memo(function Separator() {
  return <View style={s.gap} />;
});

function AppListInner<T extends Identifiable>({
  data,
  renderRow,
  onEndReached,
  header,
  footer,
  rowHeight,
  horizontal = false,
}: Props<T>) {
  // Pull-to-refresh is never declared here: the screen declares it on Screen, which hands the
  // one RefreshControl down. That keeps every spinner identical and anchored under the header.
  const pull = useScreenPullToRefresh();

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<T>) => renderRow(item),
    [renderRow],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<T> | null | undefined, index: number) => ({
      length: (rowHeight ?? 0) + SPACE.md,
      offset: ((rowHeight ?? 0) + SPACE.md) * index,
      index,
    }),
    [rowHeight],
  );

  return (
    <FlatList
      data={data as T[]}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      horizontal={horizontal}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={header ?? undefined}
      ListFooterComponent={footer ?? undefined}
      contentContainerStyle={horizontal ? s.horizontalContent : s.content}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={horizontal ? undefined : refreshControlFor(pull)}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      getItemLayout={rowHeight ? getItemLayout : undefined}
      // Enough to fill a tall phone without rendering a whole class roster up front.
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews
    />
  );
}

const keyExtractor = (item: Identifiable) => item.id;

/** Generic components lose their type parameter through memo(), so the cast restores it. */
export const AppList = memo(AppListInner) as typeof AppListInner;

const s = StyleSheet.create({
  gap: { height: SPACE.md, width: SPACE.md },
  content: { paddingBottom: SPACE.xl, flexGrow: 1 },
  horizontalContent: { paddingRight: SPACE.lg },
});
