// quiz-take-screen.tsx — modal: timer, progress, then instant rationale on the result screen.
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, ConfirmDialog, EmptyState, ListState, PageTitle, ProgressBar, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteIds } from "@/core/logic/route-params";
import { useForceBack, useSafeBack } from "@/shared/hooks/use-safe-back";
import { QuizQuestionCard } from "@/features/student/components/quiz-question-card";
import { useQuiz, useSubmitQuizAttempt } from "@/features/student/hooks/use-quizzes";
import type { QuizAnswer } from "@/features/student/types/student";

// When each quiz's countdown began. Module-level so leaving the screen and coming back resumes the
// SAME clock instead of handing out a fresh full timer.
const startedAt = new Map<string, number>();

function remainingSeconds(quizId: string, limitMin: number): number {
  const began = startedAt.get(quizId) ?? Date.now();
  startedAt.set(quizId, began);
  return Math.max(0, Math.ceil(limitMin * 60 - (Date.now() - began) / 1000));
}

export default function StudentQuizTake() {
  const { classId, quizId } = useRouteIds("classId", "quizId");
  const router = useRouter();
  const toast = useToast();
  const { data: quiz, loading, error, refetch } = useQuiz(classId, quizId);
  const submitAttempt = useSubmitQuizAttempt(classId ?? "", quizId ?? "");

  const [answers, setAnswers] = useState<Record<string, string | number | null>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  // Start the countdown once, when this quiz first loads — adjusted during render, per
  // https://react.dev/learn/you-might-not-need-an-effect, not in a useEffect.
  const [timerStartedFor, setTimerStartedFor] = useState<string | null>(null);
  if (quiz && quiz.id !== timerStartedFor) {
    setTimerStartedFor(quiz.id);
    setSecondsLeft(quiz.timeLimitMin && !quiz.closed ? remainingSeconds(quiz.id, quiz.timeLimitMin) : null);
  }

  const answeredCount = Object.values(answers).filter((v) => v !== null && v !== "").length;

  const submit = useMemo(
    () => async () => {
      if (!quiz) return;
      const list: QuizAnswer[] = quiz.questions.map((q) => ({ questionId: q.id, response: answers[q.id] ?? null }));
      const result = await submitAttempt.run(list);
      if (result.ok) {
        if (quizId) startedAt.delete(quizId);
        router.replace({ pathname: "/student/quiz-result", params: { classId, quizId, attemptId: result.value.id } });
      } else {
        toast.show(result.error.message, { tone: "red" });
      }
    },
    [quiz, answers, submitAttempt, router, classId, quizId, toast],
  );

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      void submit();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, submit]);

  const dirty = answeredCount > 0 && !quiz?.attempt;
  const fallback = classId ? { pathname: "/student/course-detail" as const, params: { id: classId } } : "/student/courses";
  const goBack = useSafeBack(fallback, { blocked: dirty, onBlocked: () => setConfirmExit(true) });
  const forceBack = useForceBack(fallback);

  useEffect(() => {
    if (quiz?.attempt) {
      router.replace({ pathname: "/student/quiz-result", params: { classId, quizId, attemptId: quiz.attempt.id } });
    }
  }, [quiz?.attempt, router, classId, quizId]);

  return (
    <Screen role="student" scope="student/quiz-take">
      <PageTitle
        title={quiz?.title ?? "Quiz"}
        subtitle={secondsLeft !== null ? `${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, "0")} left` : undefined}
        onBack={goBack}
      />
      <ListState loading={loading} error={error} empty={!loading && !quiz} onRetry={refetch} emptyIcon="help-circle-outline" emptyTitle="Quiz not found">
        {quiz && quiz.closed && !quiz.attempt ? (
          <EmptyState
            icon="lock-closed-outline"
            title="This quiz is closed"
            message="The deadline has passed and it no longer accepts submissions. Ask your instructor if you need more time."
          />
        ) : quiz ? (
          <View style={{ gap: SPACE.lg }}>
            <ProgressBar value={answeredCount / Math.max(quiz.questions.length, 1)} label={`${answeredCount}/${quiz.questions.length} answered`} />
            {quiz.questions.map((q, i) => (
              <QuizQuestionCard
                key={q.id}
                index={i}
                question={q}
                value={answers[q.id] ?? null}
                onChange={(response) => setAnswers((a) => ({ ...a, [q.id]: response }))}
                mode="take"
              />
            ))}
            <ActionButton label="Submit quiz" icon="checkmark-done-outline" loading={submitAttempt.loading} onPress={submit} />
            <Text style={[TYPE.caption, { textAlign: "center" }]}>Submitting locks your answers — review before you tap Submit.</Text>
          </View>
        ) : null}
      </ListState>

      <ConfirmDialog
        visible={confirmExit}
        title="Leave this quiz?"
        message="Your answers will not be submitted and this attempt will be lost."
        confirmLabel="Leave"
        onConfirm={() => {
          setConfirmExit(false);
          forceBack();
        }}
        onCancel={() => setConfirmExit(false)}
      />
    </Screen>
  );
}
