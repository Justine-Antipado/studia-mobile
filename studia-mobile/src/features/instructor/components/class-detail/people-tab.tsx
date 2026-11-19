// people-tab.tsx — Class detail "People" tab: roster + progress. Remove student happens on
// the student-detail screen (docs/ROUTE-MAP.md).
import { useRouter } from "expo-router";
import { View } from "react-native";

import { Badge, ListRow, ListState } from "@/shared/components/ui";
import { SPACE } from "@/shared/constants/tokens";
import { scoreTone } from "@/features/instructor/logic/format";
import { useClassStudents } from "@/features/instructor/hooks/use-students";

export function PeopleTab({ classId }: { classId: string }) {
  const router = useRouter();
  const { data, loading, error, refetch } = useClassStudents(classId);
  const students = data ?? [];

  return (
    <ListState
      loading={loading}
      error={error}
      empty={!loading && students.length === 0}
      onRetry={refetch}
      emptyIcon="people-outline"
      emptyTitle="No students yet"
      emptyMessage="Students who join with the class code will appear here."
    >
      <View style={{ gap: SPACE.md }}>
        {students.map((s) => (
          <ListRow
            key={s.id}
            icon="person-outline"
            title={s.name}
            subtitle={`${Math.round(s.progress * 100)}% progress · ${s.pendingCount} pending`}
            trailing={<Badge label={`${Math.round(s.progress * 100)}%`} tone={scoreTone(Math.round(s.progress * 100))} />}
            onPress={() => router.push({ pathname: "/instructor/student-detail", params: { classId, studentId: s.id } })}
          />
        ))}
      </View>
    </ListState>
  );
}
