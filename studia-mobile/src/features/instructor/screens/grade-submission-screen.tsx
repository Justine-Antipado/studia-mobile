// grade-submission-screen.tsx — points per essay/identification question, then "Turn in" releases
// the grade to the student. Multiple choice is auto-graded and never shown here.
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Badge, EmptyState, FormField, ListState, PageTitle } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { scoreTone, timeAgo, toPercent } from "@/features/instructor/logic/format";
import { useAllSubmissions, useGradeQuestion, useReleaseGrade, useSubmission } from "@/features/instructor/hooks/use-submissions";
import type { Submission, SubmissionAnswer } from "@/features/instructor/types/instructor";

export default function GradeSubmissionScreen() {
  const id = useRouteId();
  const goBack = useSafeBack("/instructor/grading");
  const { data: submission, loading, error, refetch } = useSubmission(id);

  return (
    <Screen role="instructor" scope="instructor/grade-submission">
      <PageTitle title="Submission" onBack={goBack} />
      <ListState
        loading={loading}
        error={error}
        empty={!loading && !submission}
        onRetry={refetch}
        emptyIcon="alert-circle-outline"
        emptyTitle="Submission not found"
        emptyMessage="It may have been removed. Go back and pick another."
      >
        {submission ? <GradeForm key={submission.id} submission={submission} /> : null}
      </ListState>
    </Screen>
  );
}

function QuestionGrader({ attemptId, index, answer }: { attemptId: string; index: number; answer: SubmissionAnswer }) {
  const gradeQuestion = useGradeQuestion(attemptId);
  const [points, setPoints] = useState(answer.awardedPoints === null ? "" : String(answer.awardedPoints));
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const result = await gradeQuestion.run({ questionId: answer.questionId, points });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError(null);
  };

  return (
    <View style={{ gap: SPACE.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: SPACE.sm }}>
        <Text style={TYPE.label}>
          {index + 1}. {answer.type === "essay" ? "Essay" : "Identification"}
        </Text>
        {answer.awardedPoints !== null ? (
          <Badge label={`${answer.awardedPoints}/${answer.maxPoints}`} tone="green" />
        ) : (
          <Badge label="Not graded" tone="orange" />
        )}
      </View>
      <Text style={TYPE.bodyStrong}>{answer.prompt}</Text>
      <Text style={TYPE.muted}>{answer.response}</Text>
      {answer.type === "identification" && answer.correctAnswer ? (
        <Text style={TYPE.caption}>Expected answer: {answer.correctAnswer}</Text>
      ) : null}
      <FormField
        label={`Points (out of ${answer.maxPoints})`}
        value={points}
        onChangeText={(v) => {
          setPoints(v);
          setError(null);
        }}
        keyboardType="decimal-pad"
        placeholder="0"
        error={error}
        maxLength={6}
      />
      <ActionButton label="Save points" icon="checkmark" variant="secondary" loading={gradeQuestion.loading} onPress={save} />
    </View>
  );
}

function GradeForm({ submission }: { submission: Submission }) {
  const router = useRouter();
  const goBack = useSafeBack("/instructor/grading");
  const all = useAllSubmissions();
  const release = useReleaseGrade(submission.id);
  const [feedback, setFeedback] = useState(submission.feedback);
  const [error, setError] = useState<string | null>(null);

  const next = useMemo(() => {
    const rest = (all.data ?? [])
      .filter((x) => x.score === null && x.id !== submission.id)
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    return rest.find((x) => x.quizId === submission.quizId) ?? rest[0] ?? null;
  }, [all.data, submission.id, submission.quizId]);

  const max = submission.maxScore;
  const graded = submission.score !== null;
  const allGraded = submission.answers.every((a) => a.awardedPoints !== null);

  const turnIn = async (goNext: boolean) => {
    const result = await release.run({ feedback });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError(null);
    if (goNext && next) router.setParams({ id: next.id });
    else goBack();
  };

  return (
    <View style={{ gap: SPACE.lg }}>
      <View>
        <Text style={TYPE.h2}>{submission.studentName}</Text>
        <Text style={TYPE.muted}>
          {submission.classCode} · {submission.quizTitle} · Submitted {timeAgo(submission.submittedAt)}
        </Text>
      </View>
      {submission.late ? <Badge label="Late" tone="orange" /> : null}
      {submission.overTime ? <Badge label="Over time" tone="orange" /> : null}
      {graded ? <Badge label={`Released ${submission.score}/${max}`} tone={scoreTone(toPercent(submission.score ?? 0, max))} /> : null}

      {submission.answers.length === 0 ? (
        <EmptyState icon="document-text-outline" title="Nothing to grade" message="This quiz was auto-scored and does not need review." />
      ) : (
        <View style={{ gap: SPACE.lg }}>
          {submission.answers.map((a, i) => (
            <QuestionGrader key={a.questionId} attemptId={submission.id} index={i} answer={a} />
          ))}
        </View>
      )}

      <FormField label="Feedback (optional)" value={feedback} onChangeText={setFeedback} placeholder="Short note for the student" multiline maxLength={500} />
      {error ? <Text style={[TYPE.caption, { color: C.red }]}>{error}</Text> : null}
      {!allGraded ? <Text style={TYPE.caption}>Every question needs points before you can turn this in.</Text> : null}

      <ActionButton label={graded ? "Update grade" : "Turn in"} disabled={!allGraded} loading={release.loading} onPress={() => turnIn(false)} />
      {!graded && next ? (
        <ActionButton
          label="Turn in & grade next"
          variant="secondary"
          icon="chevron-forward"
          disabled={!allGraded}
          loading={release.loading}
          onPress={() => turnIn(true)}
        />
      ) : null}
    </View>
  );
}
