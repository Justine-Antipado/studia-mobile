// classes-screen.tsx — Classes tab: list + create class.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton, AppList, ListRow, ListState, PageTitle } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE } from "@/shared/constants/tokens";
import { plural } from "@/features/instructor/logic/format";
import { useInstructorClasses } from "@/features/instructor/hooks/use-classes";
import type { InstructorClass } from "@/features/instructor/types/instructor";

/** Stable empty list: the loading / error / empty states are drawn by ListState below the rows. */
const NO_ROWS: InstructorClass[] = [];

export default function InstructorClassesScreen() {
  const router = useSafeRouter();
  const { data, loading, error, refetch } = useInstructorClasses();
  const classes = useMemo(() => data ?? [], [data]);

  const openCreate = useCallback(() => router.push("/instructor/create-class"), [router]);
  const openClass = useCallback(
    (id: string) => router.push({ pathname: "/instructor/class-detail", params: { id } }),
    [router],
  );

  const renderRow = useCallback(
    (c: InstructorClass) => (
      <ListRow
        icon="book-outline"
        eyebrow={`${c.code} · ${c.section}`}
        title={c.title}
        subtitle={`${plural(c.studentCount, "student")} · Code: ${c.joinCode}`}
        onPress={() => openClass(c.id)}
      />
    ),
    [openClass],
  );

  // The page chrome rides inside the list so the list itself starts at the top of the content
  // area: pull-to-refresh then comes from directly under the header, exactly like Home.
  const chrome = (
    <View style={s.chrome}>
      <PageTitle
        title="Classes"
        trailing={<ActionButton label="Create" icon="add" variant="secondary" size="sm" onPress={openCreate} />}
      />
    </View>
  );

  return (
    <Screen
      role="instructor"
      scroll={false}
      tabScreen
      scope="instructor/classes"
      contentStyle={s.flush}
      refreshing={loading}
      onRefresh={refetch}
    >
      <AppList
        data={loading || error ? NO_ROWS : classes}
        renderRow={renderRow}
        header={chrome}
        footer={
          <ListState
            loading={loading}
            error={error}
            empty={!loading && classes.length === 0}
            onRetry={refetch}
            emptyIcon="school-outline"
            emptyTitle="No classes yet"
            // F7: no second "Create class" button down here — the header action is always in reach
            // and two buttons for one action is what the empty state used to add.
            emptyMessage="Use Create above to add your first class."
          >
            {null}
          </ListState>
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  // Screen's fixed padding is moved onto the list header so the scroll area (and the refresh
  // spinner) starts flush under the header; the spacing on screen is unchanged.
  flush: { paddingTop: 0 },
  chrome: { paddingTop: SPACE.md + 2, paddingBottom: SPACE.md + 2, gap: SPACE.md + 2 },
});
