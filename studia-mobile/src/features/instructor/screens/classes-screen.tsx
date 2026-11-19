// classes-screen.tsx — Classes tab: list + create class.
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton, AppList, ListRow, ListState, PageTitle } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE } from "@/shared/constants/tokens";
import { plural } from "@/features/instructor/logic/format";
import { useInstructorClasses } from "@/features/instructor/hooks/use-classes";
import type { InstructorClass } from "@/features/instructor/types/instructor";

export default function InstructorClassesScreen() {
  const router = useRouter();
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

  return (
    <Screen role="instructor" scroll={false} scope="instructor/classes">
      <PageTitle
        title="Classes"
        trailing={<ActionButton label="Create" icon="add" onPress={openCreate} />}
      />

      <View style={s.fill}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && classes.length === 0}
          onRetry={refetch}
          emptyIcon="school-outline"
          emptyTitle="No classes yet"
          emptyMessage="Create your first class to get started."
          emptyActionLabel="Create class"
          onEmptyAction={openCreate}
        >
          <AppList data={classes} renderRow={renderRow} refreshing={loading} onRefresh={refetch} />
        </ListState>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, gap: SPACE.lg },
});
