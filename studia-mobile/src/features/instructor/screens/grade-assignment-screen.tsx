// grade-assignment-screen.tsx — one student's assignment submission: their text/file, then score
// (0..points) + feedback. Graded work appears on the student's side as soon as it is saved.
import { useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Badge, Card, Chip, FormField, ListState, PageTitle, useToast } from "@/shared/components/ui";
import { AttachmentRow } from "@/shared/components/ui/attachment-row";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteIds } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { timeAgo } from "@/features/instructor/logic/format";
import { useAssignmentSubmissions, useGradeAssignmentSubmission } from "@/features/instructor/hooks/use-assignment-submissions";
import { useInstructorAssignment } from "@/features/instructor/hooks/use-assignments";
import type { AssignmentSubmission } from "@/features/instructor/data/assignment-submissions-repository";

export default function GradeAssignmentScreen() {
  const { classId, assignmentId, studentId } = useRouteIds("classId", "assignmentId", "studentId");
  const goBack = useSafeBack(
    classId && assignmentId
      ? { pathname: "/instructor/assignment-detail", params: { classId, id: assignmentId } }
      : "/instructor/classes",
  );
  const subs = useAssignmentSubmissions(classId, assignmentId);
  const assignment = useInstructorAssignment(classId, assignmentId);
  const submission = subs.data?.find((s) => s.studentId === studentId) ?? null;

  return (
    <Screen role="instructor" scope="instructor/grade-assignment">
      <PageTitle title="Submission" subtitle={assignment.data?.title} onBack={goBack} />
      <ListState
        loading={subs.loading || assignment.loading}
        error={subs.error}
        empty={!subs.loading && !submission}
        onRetry={subs.refetch}
        emptyIcon="alert-circle-outline"
        emptyTitle="Submission not found"
      >
        {submission && classId && assignmentId && assignment.data ? (
          <GradeForm
            key={submission.studentId}
            classId={classId}
            submission={submission}
            max={assignment.data.points}
            onSaved={goBack}
          />
        ) : null}
      </ListState>
    </Screen>
  );
}

function GradeForm({
  classId,
  submission,
  max,
  onSaved,
}: {
  classId: string;
  submission: AssignmentSubmission;
  max: number;
  onSaved: () => void;
}) {
  const toast = useToast();
  const grade = useGradeAssignmentSubmission(classId, submission.assignmentId, submission.studentId);
  const [score, setScore] = useState(submission.score === null ? "" : String(submission.score));
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const result = await grade.run({ score, feedback });
    if (!result.ok) {
      setError(result.error.message);
      toast.show(result.error.message, { tone: "red" });
      return;
    }
    toast.show("Grade saved", { tone: "green" });
    onSaved();
  };

  return (
    <View style={{ gap: SPACE.lg }}>
      <View style={{ gap: SPACE.xs }}>
        <Text style={TYPE.h2}>{submission.studentName}</Text>
        <Text style={TYPE.muted}>
          {submission.submittedAt ? `Turned in ${timeAgo(submission.submittedAt)}` : "Not turned in"}
        </Text>
        {submission.status === "late" ? <Badge label="Late" tone="orange" /> : null}
      </View>

      <Card>
        <Text style={TYPE.label}>Answer</Text>
        <Text style={[TYPE.body, { marginTop: SPACE.xs }]}>{submission.text ?? "No written answer."}</Text>
      </Card>
      {submission.file ? <AttachmentRow attachment={submission.file} /> : null}

      <FormField
        label={`Score (out of ${max})`}
        value={score}
        onChangeText={(v) => {
          setScore(v);
          setError(null);
        }}
        keyboardType="decimal-pad"
        placeholder="0"
        error={error}
        maxLength={6}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
        {[1, 0.9, 0.75, 0.5, 0].map((p) => {
          const value = String(Math.round(max * p));
          return (
            <Chip
              key={p}
              label={value}
              selected={score.trim() === value}
              onPress={() => {
                setScore(value);
                setError(null);
              }}
            />
          );
        })}
      </View>
      <FormField
        label="Feedback (optional)"
        value={feedback}
        onChangeText={setFeedback}
        placeholder="Short note for the student"
        multiline
        maxLength={500}
      />
      <ActionButton label="Save grade" loading={grade.loading} onPress={save} />
    </View>
  );
}
