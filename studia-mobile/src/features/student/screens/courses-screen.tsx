// courses-screen.tsx — list of joined classes + "Join Class" entry point (modal route).
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton, AppList, ListState, PageTitle } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE } from "@/shared/constants/tokens";
import { ClassCard } from "@/features/student/components/class-card";
import { useClasses } from "@/features/student/hooks/use-classes";
import type { StudentClass } from "@/features/student/types/student";

/** Stable empty list: the loading / error / empty states are drawn by ListState below the rows. */
const NO_ROWS: StudentClass[] = [];

export default function StudentCourses() {
  const router = useSafeRouter();
  const { data, loading, error, refetch } = useClasses();
  const classes = data ?? [];

  const openClass = useCallback(
    (id: string) => router.push({ pathname: "/student/course-detail", params: { id } }),
    [router],
  );

  const renderRow = useCallback(
    (item: StudentClass) => <ClassCard item={item} onPress={() => openClass(item.id)} />,
    [openClass],
  );

  const openJoin = useCallback(() => router.push("/student/join-class"), [router]);

  // The page chrome rides inside the list so the list itself starts at the top of the content
  // area: pull-to-refresh then comes from directly under the header, exactly like Home.
  const chrome = (
    <View style={s.chrome}>
      <PageTitle title="Courses" />
      <ActionButton label="Join Class" icon="add" onPress={openJoin} />
    </View>
  );

  return (
    <Screen
      role="student"
      scroll={false}
      tabScreen
      scope="student/courses"
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
            emptyIcon="book-outline"
            emptyTitle="No classes yet"
            // G1: no second "Join Class" button in the empty state — the one above the list is
            // always visible, so the empty state only has to say what to do.
            emptyMessage="Use Join Class above and enter the 6-character code from your instructor."
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
