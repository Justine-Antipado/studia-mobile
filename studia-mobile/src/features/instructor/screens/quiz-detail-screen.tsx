// quiz-detail-screen.tsx — quiz preview (Draft / Published), questions, grading shortcut.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton, Badge, Card, ConfirmDialog, ListState, PageTitle, formatDateTime } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { TONES, type Tone } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { dueLabel } from "@/features/instructor/logic/format";
import { OPTION_LABELS } from "@/features/instructor/logic/quiz-validation";
import { useDeleteQuiz, useQuiz } from "@/features/instructor/hooks/use-quizzes";
import type { QuizStatus } from "@/features/instructor/types/instructor";

const STATUS_TONE: Record<QuizStatus, Tone> = { draft: "primary", published: "green" };
const STATUS_LABEL: Record<QuizStatus, string> = { draft: "Draft", published: "Published" };

export default function QuizDetailScreen() {
  const id = useRouteId();
  const router = useSafeRouter();
  const goBack = useSafeBack("/instructor/assessments");
  const { data: quiz, loading, error, refetch } = useQuiz(id);
  const deleteQuiz = useDeleteQuiz(quiz?.classId ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = async () => {
    if (!id) return;
    const result = await deleteQuiz.run(id);
    setConfirmDelete(false);
    if (result.ok) goBack();
  };

  return (
    <Screen role="instructor" scope="instructor/quiz-detail">
      <PageTitle title={quiz?.title ?? "Quiz"} onBack={goBack} />
      <ListState
        loading={loading}
        error={error}
        empty={!loading && !quiz}
        onRetry={refetch}
        emptyIcon="help-circle-outline"
        emptyTitle="Quiz not found"
      >
        {quiz ? (
          <View style={{ gap: SPACE.lg }}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: SPACE.sm }}>
                <Text style={TYPE.h3} numberOfLines={1}>{quiz.classCode}</Text>
                <Badge label={STATUS_LABEL[quiz.status]} tone={STATUS_TONE[quiz.status]} />
              </View>
              <Text style={[TYPE.muted, { marginTop: 4 }]}>
                {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"} · {quiz.source === "ai" ? "AI-generated" : "Manual"}
              </Text>
              {quiz.dueAt ? <Text style={TYPE.muted}>{dueLabel(quiz.dueAt)}</Text> : null}
              <Text style={TYPE.muted}>
                {quiz.allowLate && quiz.closesAt ? `Late attempts allowed until ${formatDateTime(new Date(quiz.closesAt))}` : "No late attempts"}
                {quiz.timeLimitMin ? ` · ${quiz.timeLimitMin} min limit` : ""}
              </Text>
              <Text style={TYPE.muted}>{`${quiz.attemptCount} submission${quiz.attemptCount === 1 ? "" : "s"}`}</Text>
            </Card>

            {quiz.questions.map((q, i) => (
              <Card key={q.id}>
                <Text style={TYPE.bodyStrong}>{i + 1}. {q.text}</Text>
                {q.type === "multiple_choice" && q.options
                  ? q.options.map((o, k) => (
                      <Text key={k} style={[TYPE.muted, k === q.correctIndex && s.correct]}>
                        {OPTION_LABELS[k]}. {o}
                      </Text>
                    ))
                  : q.type === "identification"
                    ? <Text style={TYPE.muted}>Answer: {q.correctAnswer} · Confirmed manually</Text>
                    : <Text style={TYPE.muted}>Graded manually (essay)</Text>}
              </Card>
            ))}

            <ActionButton
              label="Edit quiz"
              icon="create-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: "/instructor/edit-quiz", params: { id: quiz.id } })}
            />
            <ActionButton label="Delete quiz" icon="trash-outline" variant="danger" onPress={() => setConfirmDelete(true)} />
          </View>
        ) : null}
      </ListState>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this quiz?"
        message="Students will no longer be able to open it."
        confirmLabel="Delete"
        busy={deleteQuiz.loading}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  correct: { color: TONES.green.strong },
});
