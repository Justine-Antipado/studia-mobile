import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Button, Chip, EmptyState, Field, Page, PageTitle, Pill } from "@/features/instructor/components/instructor-ui";
import { gradeSubmission, useSubmission, useSubmissions } from "@/features/instructor/data/instructor-store";
import { firstParam, scoreTone, timeAgo, toPercent } from "@/features/instructor/logic/format";
import type { Submission } from "@/features/instructor/types/instructor";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import { useSafeBack } from "@/shared/hooks/use-safe-back";

export default function GradeSubmissionScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const submission = useSubmission(firstParam(id));
  const goBack = useSafeBack("/instructor/grading");

  if (!submission) {
    return (
      <Screen role="instructor">
        <Page>
          <PageTitle title="Submission" onBack={goBack} />
          <EmptyState icon="alert-circle-outline" title="Submission not found" message="It may have been removed. Go back and pick another." />
        </Page>
      </Screen>
    );
  }
  // key => form state resets when "Save & next" swaps the submission
  return <GradeForm key={submission.id} submission={submission} />;
}

function GradeForm({ submission }: { submission: Submission }) {
  const router = useRouter();
  const goBack = useSafeBack("/instructor/grading");
  const all = useSubmissions();
  const [score, setScore] = useState(submission.score === null ? "" : String(submission.score));
  const [feedback, setFeedback] = useState(submission.feedback);
  const [error, setError] = useState<string | null>(null);

  const next = useMemo(() => {
    const rest = all
      .filter((x) => x.score === null && x.id !== submission.id)
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    return rest.find((x) => x.quizId === submission.quizId) ?? rest[0] ?? null;
  }, [all, submission.id, submission.quizId]);

  const max = submission.maxScore;
  const graded = submission.score !== null;

  const save = (goNext: boolean) => {
    const res = gradeSubmission(submission.id, score, feedback);
    if (!res.ok) return setError(res.error);
    setError(null);
    if (goNext && next) router.setParams({ id: next.id });
    else Alert.alert("Grade saved", `${submission.studentName}: ${score.trim()}/${max}`, [{ text: "OK", onPress: goBack }]);
  };

  return (
    <Screen role="instructor">
      <Page>
        <PageTitle
          title={submission.studentName}
          subtitle={`${submission.classCode} · ${submission.quizTitle} · Submitted ${timeAgo(submission.submittedAt)}`}
          onBack={goBack}
        />
        {graded ? <Pill label={`Graded ${submission.score}/${max}`} tone={scoreTone(toPercent(submission.score ?? 0, max))} /> : null}

        {submission.answers.length === 0 ? (
          <EmptyState icon="document-text-outline" title="No written answers" message="This quiz was auto-scored. You can still adjust the score." />
        ) : (
          submission.answers.map((a, i) => (
            <View key={i} style={s.qa}>
              <Text style={s.prompt}>{i + 1}. {a.prompt}</Text>
              <Text style={s.response}>{a.response}</Text>
            </View>
          ))
        )}

        <Field label={`Score (out of ${max})`} value={score} onChangeText={(v) => { setScore(v); setError(null); }} keyboardType="decimal-pad" placeholder="0" error={error} maxLength={6} />
        <View style={s.chips}>
          {[1, 0.9, 0.75, 0.5, 0].map((p) => (
            <Chip key={p} label={String(Math.round(max * p))} selected={score.trim() === String(Math.round(max * p))} onPress={() => { setScore(String(Math.round(max * p))); setError(null); }} />
          ))}
        </View>
        <Field label="Feedback (optional)" value={feedback} onChangeText={setFeedback} placeholder="Short note for the student" multiline maxLength={500} />

        <Button title="Save grade" onPress={() => save(false)} />
        {!graded && next ? <Button title="Save & grade next" variant="secondary" icon="chevron-forward" onPress={() => save(true)} /> : null}
      </Page>
    </Screen>
  );
}

const s = StyleSheet.create({
  qa: { gap: 6, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  prompt: { fontSize: 15, fontWeight: "700", color: C.text },
  response: { fontSize: 15, color: C.muted, lineHeight: 22 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
