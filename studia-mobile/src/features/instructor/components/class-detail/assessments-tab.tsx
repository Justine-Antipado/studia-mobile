// assessments-tab.tsx — Class detail "Assessments" tab: this class's assignments + quizzes.
// The "Post" button is the one entry point for creating either kind: it sits above the lists so
// it stays reachable no matter how many assignments/quizzes pile up underneath it, and opens a
// sheet where the instructor picks Assignment, Quiz, or an AI-generated quiz.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Badge, BottomSheet, ListRow, ListState, SectionHeader } from "@/shared/components/ui";
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
  const [postOpen, setPostOpen] = useState(false);

  const postAssignment = () => {
    setPostOpen(false);
    router.push({ pathname: "/instructor/create-assignment", params: { classId } });
  };
  const postQuiz = () => {
    setPostOpen(false);
    router.push({ pathname: "/instructor/create-quiz", params: { classId } });
  };
  const postAiQuiz = () => {
    setPostOpen(false);
    router.push({ pathname: "/instructor/ai-quiz", params: { classId } });
  };

  return (
    <View style={{ gap: SPACE.lg }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <SectionHeader title="Assessments" />
        <ActionButton label="Post" icon="add" variant="secondary" size="sm" onPress={() => setPostOpen(true)} />
      </View>

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
        emptyMessage="Use Post above to create an assignment or quiz."
      >
        <View style={{ gap: SPACE.lg }}>
          <View style={{ gap: SPACE.md }}>
            <SectionHeader title="Assignments" />
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
            <SectionHeader title="Quizzes" />
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

      <BottomSheet visible={postOpen} title="Post an assessment" onClose={() => setPostOpen(false)}>
        <ActionButton label="New Assignment" icon="document-text-outline" variant="secondary" onPress={postAssignment} />
        <ActionButton label="New Quiz" icon="help-circle-outline" variant="secondary" onPress={postQuiz} />
        <ActionButton label="Generate Quiz with AI" icon="sparkles-outline" onPress={postAiQuiz} />
      </BottomSheet>
    </View>
  );
}
