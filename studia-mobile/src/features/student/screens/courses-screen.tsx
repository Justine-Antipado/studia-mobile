// courses-screen.tsx — list of joined classes + "Join Class" entry point (modal route).
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton, AppList, ListState, PageTitle } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { ClassCard } from "@/features/student/components/class-card";
import { useClasses } from "@/features/student/hooks/use-classes";
import type { StudentClass } from "@/features/student/types/student";

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

  return (
    <Screen role="student" scroll={false} scope="student/courses">
      <PageTitle title="Courses" />
      <ActionButton label="Join Class" icon="add" onPress={openJoin} />

      <View style={s.fill}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && classes.length === 0}
          onRetry={refetch}
          emptyIcon="book-outline"
          emptyTitle="No classes yet"
          emptyMessage="Join a class with the 6-character code from your instructor."
          emptyActionLabel="Join Class"
          onEmptyAction={openJoin}
        >
          <AppList data={classes} renderRow={renderRow} refreshing={loading} onRefresh={refetch} />
        </ListState>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
});
