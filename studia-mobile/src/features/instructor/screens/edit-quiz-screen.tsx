// edit-quiz-screen.tsx — modal: the shared QuizForm in "edit" mode, preloaded with the quiz.
import { useRouter } from "expo-router";
import { useMemo } from "react";

import { ListState, PageTitle, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { QuizForm } from "@/features/instructor/components/quiz-form";
import { useQuiz, useUpdateQuiz } from "@/features/instructor/hooks/use-quizzes";

export default function EditQuizScreen() {
  const id = useRouteId();
  const router = useRouter();
  const toast = useToast();
  const goBack = useSafeBack(id ? { pathname: "/instructor/quiz-detail", params: { id } } : "/instructor/assessments");
  const { data: quiz, loading, error, refetch } = useQuiz(id);
  const update = useUpdateQuiz(id ?? "");

  const initial = useMemo(
    () =>
      quiz
        ? {
            title: quiz.title,
            classId: quiz.classId,
            questions: quiz.questions,
            dueAt: quiz.dueAt,
            allowLate: quiz.allowLate,
            closesAt: quiz.closesAt,
            timeLimitMin: quiz.timeLimitMin,
            status: quiz.status,
            attemptCount: quiz.attemptCount,
          }
        : undefined,
    [quiz],
  );

  if (!initial || !id) {
    return (
      <Screen role="instructor" scope="instructor/edit-quiz">
        <PageTitle title="Edit Quiz" onBack={goBack} />
        <ListState loading={loading} error={error} empty={!loading} onRetry={refetch} emptyIcon="help-circle-outline" emptyTitle="Quiz not found">
          {null}
        </ListState>
      </Screen>
    );
  }

  return (
    <QuizForm
      key={quiz?.id}
      mode="edit"
      initial={initial}
      fallback={{ pathname: "/instructor/quiz-detail", params: { id } }}
      loading={update.loading}
      onSubmit={async (draft, publish) => {
        const result = await update.run({ draft, publish });
        if (!result.ok) return { ok: false, message: result.error.message };
        toast.show("Quiz updated", { tone: "green" });
        router.replace({ pathname: "/instructor/quiz-detail", params: { id } });
        return { ok: true };
      }}
    />
  );
}
