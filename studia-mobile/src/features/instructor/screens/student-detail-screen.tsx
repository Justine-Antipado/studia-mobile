// student-detail-screen.tsx — student profile + progress, remove from class (confirm).
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Avatar, Card, ConfirmDialog, ListState, PageTitle, ProgressBar, StatCard } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteIds } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { useRemoveStudent, useStudent } from "@/features/instructor/hooks/use-students";

export default function StudentDetailScreen() {
  const { classId, studentId } = useRouteIds("classId", "studentId");
  const router = useRouter();
  const goBack = useSafeBack(classId ? { pathname: "/instructor/class-detail", params: { id: classId } } : "/instructor/classes");
  const { data: student, loading, error, refetch } = useStudent(classId, studentId);
  const removeStudent = useRemoveStudent(classId ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const remove = async () => {
    if (!studentId) return;
    const result = await removeStudent.run(studentId);
    setConfirmRemove(false);
    if (result.ok && classId) router.replace({ pathname: "/instructor/class-detail", params: { id: classId } });
  };

  return (
    <Screen role="instructor" scope="instructor/student-detail">
      <PageTitle title={student?.name ?? "Student"} onBack={goBack} />
      <ListState
        loading={loading}
        error={error}
        empty={!loading && !student}
        onRetry={refetch}
        emptyIcon="person-outline"
        emptyTitle="Student not found"
      >
        {student ? (
          <View style={{ gap: SPACE.lg }}>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
                <Avatar name={student.name} userId={student.id} size={56} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={TYPE.h3} numberOfLines={1}>{student.name}</Text>
                  <Text style={TYPE.muted} numberOfLines={1}>{student.email}</Text>
                  <Text style={TYPE.caption}>{student.section}</Text>
                </View>
              </View>
              <View style={{ marginTop: SPACE.md, gap: 6 }}>
                <Text style={TYPE.label}>Progress</Text>
                <ProgressBar value={student.progress} />
              </View>
            </Card>

            <View style={{ flexDirection: "row", gap: SPACE.md }}>
              <StatCard label="Submitted" value={student.submittedCount} tone="green" />
              <StatCard label="Pending" value={student.pendingCount} tone={student.pendingCount > 0 ? "orange" : "green"} />
            </View>

            <ActionButton label="Remove from class" icon="person-remove-outline" variant="danger" onPress={() => setConfirmRemove(true)} />
          </View>
        ) : null}
      </ListState>

      <ConfirmDialog
        visible={confirmRemove}
        title={student ? `Remove ${student.name}?` : "Remove this student?"}
        message="They will lose access to this class and must rejoin with the class code."
        confirmLabel="Remove"
        busy={removeStudent.loading}
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />
    </Screen>
  );
}
