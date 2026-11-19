// tasks-tab.tsx — Course detail "Tasks" tab: this class's assignments + quizzes.
import { useRouter } from "expo-router";
import { View } from "react-native";

import { Badge, ListRow, ListState } from "@/shared/components/ui";
import { SPACE } from "@/shared/constants/tokens";
import { dueLabel } from "@/features/student/logic/format";
import { useAssignments } from "@/features/student/hooks/use-assignments";
import { useQuizzes } from "@/features/student/hooks/use-quizzes";

const STATUS_TONE = { assigned: "primary", draft: "orange", submitted: "green", late: "orange", graded: "green" } as const;
const STATUS_LABEL = { assigned: "Assigned", draft: "Draft", submitted: "Submitted", late: "Late", graded: "Graded" } as const;

export function TasksTab({ classId }: { classId: string }) {
  const router = useRouter();
  const assignments = useAssignments(classId);
  const quizzes = useQuizzes(classId);
  const loading = assignments.loading || quizzes.loading;
  const error = assignments.error ?? quizzes.error;
  const items = [...(assignments.data ?? []), ...(quizzes.data ?? [])];

  return (
    <ListState
      loading={loading}
      error={error}
      empty={!loading && items.length === 0}
      onRetry={() => {
        assignments.refetch();
        quizzes.refetch();
      }}
      emptyIcon="checkmark-done-outline"
      emptyTitle="No tasks yet"
      emptyMessage="Assignments and quizzes for this class will show up here."
    >
      <View style={{ gap: SPACE.md }}>
        {(assignments.data ?? []).map((a) => (
          <ListRow
            key={a.id}
            icon="document-text-outline"
            title={a.title}
            subtitle={dueLabel(a.dueAt)}
            onPress={() => router.push({ pathname: "/student/assignment-detail", params: { classId, id: a.id } })}
            trailing={<Badge label={STATUS_LABEL[a.status]} tone={STATUS_TONE[a.status]} />}
          />
        ))}
        {(quizzes.data ?? []).map((q) => (
          <ListRow
            key={q.id}
            icon="help-circle-outline"
            title={q.title}
            subtitle={q.dueAt ? dueLabel(q.dueAt) : "No due date"}
            onPress={() =>
              router.push(
                q.attempt
                  ? { pathname: "/student/quiz-result", params: { classId, quizId: q.id, attemptId: q.attempt.id } }
                  : { pathname: "/student/quiz-take", params: { classId, quizId: q.id } },
              )
            }
            trailing={<Badge label={q.attempt ? "Submitted" : "Open"} tone={q.attempt ? "green" : "blue"} />}
          />
        ))}
      </View>
    </ListState>
  );
}
