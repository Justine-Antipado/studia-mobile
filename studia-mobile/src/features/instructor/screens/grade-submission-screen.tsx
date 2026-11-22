// grade-submission-screen.tsx — score + feedback, with a "Save & grade next" shortcut.
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Badge, Chip, EmptyState, FormField, ListState, PageTitle } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { scoreTone, timeAgo, toPercent } from "@/features/instructor/logic/format";
import { useAllSubmissions, useGradeSubmission, useSubmission } from "@/features/instructor/hooks/use-submissions";
import type { Submission } from "@/features/instructor/types/instructor";

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

function GradeForm({ submission }: { submission: Submission }) {
  const router = useRouter();
  const goBack = useSafeBack("/instructor/grading");
  const all = useAllSubmissions();
  const grade = useGradeSubmission(submission.id);
  const [score, setScore] = useState(submission.score === null ? "" : String(submission.score));
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

  const save = async (goNext: boolean) => {
    const result = await grade.run({ score, feedback });
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
      {graded ? <Badge label={`Graded ${submission.score}/${max}`} tone={scoreTone(toPercent(submission.score ?? 0, max))} /> : null}

      {submission.answers.length === 0 ? (
        <EmptyState icon="document-text-outline" title="No written answers" message="This quiz was auto-scored. You can still adjust the score." />
      ) : (
        <View style={{ gap: SPACE.md }}>
          {submission.answers.map((a, i) => (
            <View key={i} style={{ gap: 6 }}>
              <Text style={TYPE.bodyStrong}>{i + 1}. {a.prompt}</Text>
              <Text style={TYPE.muted}>{a.response}</Text>
            </View>
          ))}
        </View>
      )}

      <FormField
        label={`Score (out of ${max})`}
        value={score}
        onChangeText={(v) => { setScore(v); setError(null); }}
        keyboardType="decimal-pad"
        placeholder="0"
        error={error}
        maxLength={6}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
        {[1, 0.9, 0.75, 0.5, 0].map((p) => {
          const value = String(Math.round(max * p));
          return <Chip key={p} label={value} selected={score.trim() === value} onPress={() => { setScore(value); setError(null); }} />;
        })}
      </View>
      <FormField label="Feedback (optional)" value={feedback} onChangeText={setFeedback} placeholder="Short note for the student" multiline maxLength={500} />

      <ActionButton label="Save grade" loading={grade.loading} onPress={() => save(false)} />
      {!graded && next ? (
        <ActionButton label="Save & grade next" variant="secondary" icon="chevron-forward" loading={grade.loading} onPress={() => save(true)} />
      ) : null}
    </View>
  );
}
