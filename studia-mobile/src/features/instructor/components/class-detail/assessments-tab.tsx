// assessments-tab.tsx — Class detail "Assessments" tab: this class's assignments + quizzes.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { Text, View } from "react-native";

import { ActionButton, Badge, ListRow, ListState, SectionHeader } from "@/shared/components/ui";
import type { Tone } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { dueLabel } from "@/features/instructor/logic/format";
import { useClassAssignments } from "@/features/instructor/hooks/use-assignments";
import { useClassQuizzes } from "@/features/instructor/hooks/use-quizzes";
import type { QuizStatus } from "@/features/instructor/types/instructor";

const QUIZ_STATUS_TONE: Record<QuizStatus, Tone> = { draft: "primary", published: "green" };
const QUIZ_STATUS_LABEL: Record<QuizStatus, string> = { draft: "Draft", published: "Published" };

export function AssessmentsTab({ classId }: { classId: string }) {
  const router = useSafeRouter();
  const assignments = useClassAssignments(classId);
  const quizzes = useClassQuizzes(classId);
  const loading = assignments.loading || quizzes.loading;
  const error = assignments.error ?? quizzes.error;
  const empty = (assignments.data ?? []).length === 0 && (quizzes.data ?? []).length === 0;

  return (
    <ListState
      loading={loading}
      error={error}
      empty={!loading && empty}
      onRetry={() => {
        assignments.refetch();
        quizzes.refetch();
      }}
      emptyIcon="clipboard-outline"
      emptyTitle="No assessments yet"
      emptyMessage="Create an assignment or quiz for this class."
    >
      <View style={{ gap: SPACE.lg }}>
        <View style={{ gap: SPACE.md }}>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              rowGap: SPACE.sm,
              columnGap: SPACE.sm,
            }}
          >
            <SectionHeader title="Assignments" />
            <ActionButton
              label="New"
              icon="add"
              variant="secondary"
              onPress={() => router.push({ pathname: "/instructor/create-assignment", params: { classId } })}
            />
          </View>
          {(assignments.data ?? []).length === 0 ? (
            <Text style={TYPE.muted}>No assignments yet.</Text>
          ) : (
            (assignments.data ?? []).map((a) => (
              <ListRow
                key={a.id}
                icon="document-text-outline"
                title={a.title}
                subtitle={`${dueLabel(a.dueAt)} · ${a.points} pts`}
                onPress={() => router.push({ pathname: "/instructor/assignment-detail", params: { classId, id: a.id } })}
              />
            ))
          )}
        </View>

        <View style={{ gap: SPACE.md }}>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              rowGap: SPACE.sm,
              columnGap: SPACE.sm,
            }}
          >
            <SectionHeader title="Quizzes" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
              <ActionButton
                label="AI"
                icon="sparkles-outline"
                variant="secondary"
                onPress={() => router.push({ pathname: "/instructor/ai-quiz", params: { classId } })}
              />
              <ActionButton
                label="New"
                icon="add"
                variant="secondary"
                onPress={() => router.push({ pathname: "/instructor/create-quiz", params: { classId } })}
              />
            </View>
          </View>
          {(quizzes.data ?? []).length === 0 ? (
            <Text style={TYPE.muted}>No quizzes yet.</Text>
          ) : (
            (quizzes.data ?? []).map((q) => (
              <ListRow
                key={q.id}
                icon="help-circle-outline"
                title={q.title}
                subtitle={`${q.questions.length} item${q.questions.length === 1 ? "" : "s"}`}
                trailing={<Badge label={QUIZ_STATUS_LABEL[q.status]} tone={QUIZ_STATUS_TONE[q.status]} />}
                onPress={() => router.push({ pathname: "/instructor/quiz-detail", params: { id: q.id } })}
              />
            ))
          )}
        </View>
      </View>
    </ListState>
  );
}
