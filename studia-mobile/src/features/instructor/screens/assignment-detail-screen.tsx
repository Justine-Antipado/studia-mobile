// assignment-detail-screen.tsx — instructor view: instructions, due date, points, late rule,
// attachments, who turned it in / is missing (tap to grade), delete (confirm).
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Badge, Card, ConfirmDialog, ListState, PageTitle } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteIds } from "@/core/logic/route-params";
import { useOpenFile } from "@/features/shared-screens/hooks/use-open-file";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { AttachmentRow } from "@/shared/components/ui/attachment-row";
import { AssignmentSubmissions } from "@/features/instructor/components/assignment-submissions";
import { dueLabel } from "@/features/instructor/logic/format";
import { useDeleteAssignment, useInstructorAssignment } from "@/features/instructor/hooks/use-assignments";

export default function InstructorAssignmentDetailScreen() {
  const { classId, id } = useRouteIds("classId", "id");
  const router = useSafeRouter();
  const goBack = useSafeBack(classId ? { pathname: "/instructor/class-detail", params: { id: classId } } : "/instructor/classes");
  const openFile = useOpenFile("instructor");
  const { data: assignment, loading, error, refetch } = useInstructorAssignment(classId, id);
  const deleteAssignment = useDeleteAssignment(classId ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = async () => {
    if (!id) return;
    const result = await deleteAssignment.run(id);
    setConfirmDelete(false);
    if (result.ok && classId) router.replace({ pathname: "/instructor/class-detail", params: { id: classId } });
  };

  return (
    <Screen role="instructor" scope="instructor/assignment-detail">
      <PageTitle title={assignment?.title ?? "Assignment"} onBack={goBack} />
      <ListState
        loading={loading}
        error={error}
        empty={!loading && !assignment}
        onRetry={refetch}
        emptyIcon="document-text-outline"
        emptyTitle="Assignment not found"
      >
        {assignment ? (
          <View style={{ gap: SPACE.lg }}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: SPACE.sm }}>
                <Text style={TYPE.h3} numberOfLines={1}>{assignment.points} points</Text>
                <Badge label={assignment.allowLate ? "Late allowed" : "No late submissions"} tone={assignment.allowLate ? "blue" : "orange"} />
              </View>
              <Text style={[TYPE.muted, { marginTop: 4 }]}>{dueLabel(assignment.dueAt)}</Text>
              <Text style={[TYPE.body, { marginTop: SPACE.sm }]}>{assignment.instructions}</Text>
            </Card>

            {assignment.attachments.length > 0 ? (
              <View style={{ gap: SPACE.sm }}>
                <Text style={TYPE.label}>Attachments</Text>
                {assignment.attachments.map((a) => <AttachmentRow key={a.id} attachment={a} onPress={() => openFile(a.id)} />)}
              </View>
            ) : null}

            <ActionButton
              label="Edit assignment"
              icon="create-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: "/instructor/edit-assignment", params: { classId: classId ?? "", id: id ?? "" } })}
            />

            {classId && id ? <AssignmentSubmissions classId={classId} assignmentId={id} points={assignment.points} /> : null}

            <ActionButton label="Delete assignment" icon="trash-outline" variant="danger" onPress={() => setConfirmDelete(true)} />
          </View>
        ) : null}
      </ListState>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this assignment?"
        message="Students will no longer see it, and any submissions will be lost."
        confirmLabel="Delete"
        busy={deleteAssignment.loading}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}
