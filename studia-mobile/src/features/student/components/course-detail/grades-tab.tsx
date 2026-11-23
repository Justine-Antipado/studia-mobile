// grades-tab.tsx — Course detail "Grades" tab: graded assignments + quiz attempts for this class.
import { View } from "react-native";

import { Badge, FeedbackNote, ListRow, ListState } from "@/shared/components/ui";
import { SPACE } from "@/shared/constants/tokens";
import { scoreTone, toPercent } from "@/features/student/logic/format";
import { useAssignments } from "@/features/student/hooks/use-assignments";
import { useQuizzes } from "@/features/student/hooks/use-quizzes";

export function GradesTab({ classId }: { classId: string }) {
  const assignments = useAssignments(classId);
  const quizzes = useQuizzes(classId);
  const loading = assignments.loading || quizzes.loading;
  const error = assignments.error ?? quizzes.error;

  const gradedAssignments = (assignments.data ?? []).filter((a) => a.score !== null);
  const gradedQuizzes = (quizzes.data ?? []).filter((q) => q.attempt?.score !== null && q.attempt !== null);
  const empty = gradedAssignments.length === 0 && gradedQuizzes.length === 0;

  return (
    <ListState
      loading={loading}
      error={error}
      empty={!loading && empty}
      onRetry={() => {
        assignments.refetch();
        quizzes.refetch();
      }}
      emptyIcon="bar-chart-outline"
      emptyTitle="No grades yet"
      emptyMessage="Scores will appear here once your instructor grades your work."
    >
      <View style={{ gap: SPACE.md }}>
        {gradedAssignments.map((a) => {
          const percent = toPercent(a.score!, a.points);
          return (
            <ListRow
              key={a.id}
              icon="document-text-outline"
              title={a.title}
              subtitle={`${a.score}/${a.points} pts`}
              trailing={<Badge label={`${percent}%`} tone={scoreTone(percent)} />}
              footer={<FeedbackNote feedback={a.feedback} variant="compact" />}
            />
          );
        })}
        {gradedQuizzes.map((q) => {
          const percent = toPercent(q.attempt!.score!, q.attempt!.maxScore);
          return (
            <ListRow
              key={q.id}
              icon="help-circle-outline"
              title={q.title}
              subtitle={`${q.attempt!.score}/${q.attempt!.maxScore} pts`}
              trailing={<Badge label={`${percent}%`} tone={scoreTone(percent)} />}
              footer={<FeedbackNote feedback={q.attempt!.feedback} variant="compact" />}
            />
          );
        })}
      </View>
    </ListState>
  );
}
