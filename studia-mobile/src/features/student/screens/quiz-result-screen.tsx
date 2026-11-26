// quiz-result-screen.tsx — score + per-question review with instant rationale.
import { Text, View } from "react-native";

import { Badge, FeedbackNote, ListState, PageTitle, ProgressBar } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteIds } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { QuizQuestionCard } from "@/features/student/components/quiz-question-card";
import { scoreTone, toPercent } from "@/features/student/logic/format";
import { useQuiz } from "@/features/student/hooks/use-quizzes";

export default function StudentQuizResult() {
  const { classId, quizId } = useRouteIds("classId", "quizId");
  const goBack = useSafeBack(classId ? { pathname: "/student/course-detail", params: { id: classId } } : "/student/courses");
  const { data: quiz, loading, error, refetch } = useQuiz(classId, quizId);
  const attempt = quiz?.attempt ?? null;

  return (
    <Screen role="student" scope="student/quiz-result">
      <PageTitle title={quiz?.title ?? "Result"} onBack={goBack} />
      <ListState
        loading={loading}
        error={error}
        empty={!loading && (!quiz || !attempt)}
        onRetry={refetch}
        emptyIcon="help-circle-outline"
        emptyTitle="Result not found"
      >
        {quiz && attempt ? (
          <View style={{ gap: SPACE.lg }}>
            <View style={{ alignItems: "center", gap: SPACE.sm }}>
              {attempt.score !== null ? (
                <>
                  <Text style={TYPE.muted}>Your score</Text>
                  <Text style={TYPE.h1}>
                    {attempt.score}/{attempt.maxScore}
                  </Text>
                  <Badge label={`${toPercent(attempt.score, attempt.maxScore)}%`} tone={scoreTone(toPercent(attempt.score, attempt.maxScore))} />
                  <ProgressBar value={attempt.score / Math.max(attempt.maxScore, 1)} />
                </>
              ) : (
                <>
                  <Badge label="Pending grading" tone="orange" />
                  <Text style={TYPE.muted}>
                    Your instructor has not graded this quiz yet. You will see your score once they do.
                  </Text>
                </>
              )}
            </View>

            {/* G2: the instructor's note, right under the score. */}
            <FeedbackNote feedback={attempt.feedback} />

            {quiz.questions.map((q, i) => (
              <QuizQuestionCard
                key={q.id}
                index={i}
                question={q}
                value={attempt.answers.find((a) => a.questionId === q.id)?.response ?? null}
                mode="review"
              />
            ))}
          </View>
        ) : null}
      </ListState>
    </Screen>
  );
}
