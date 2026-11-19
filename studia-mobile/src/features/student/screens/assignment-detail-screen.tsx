// assignment-detail-screen.tsx — instructions, submission, late rule, grade.
// Late rule: allowLate -> submitting after dueAt is tagged "late". !allowLate and overdue ->
// the picked file is saved as a draft only; reopening shows "Turn in" (docs/UI-BRIEF).
import { useState } from "react";
import { Text, View } from "react-native";

import {
  ActionButton,
  Badge,
  Card,
  ConfirmDialog,
  FormField,
  ListState,
  PageTitle,
  useToast,
} from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import type { Tone } from "@/shared/constants/studia-colors";
import { useRouteIds } from "@/core/logic/route-params";
import { useForceBack, useSafeBack } from "@/shared/hooks/use-safe-back";
import { AttachmentRow } from "@/shared/components/ui/attachment-row";
import { dueLabel, scoreTone, toPercent } from "@/features/student/logic/format";
import { validateSubmissionText } from "@/features/student/logic/validators";
import { useAssignment, useAttachAssignment, useTurnInAssignment } from "@/features/student/hooks/use-assignments";
import { useFilePicker } from "@/features/student/hooks/use-file-picker";
import type { Attachment, SubmissionStatus } from "@/features/student/types/student";

const STATUS_TONE: Record<SubmissionStatus, Tone> = {
  assigned: "primary", draft: "orange", submitted: "green", late: "orange", graded: "green",
};
const STATUS_LABEL: Record<SubmissionStatus, string> = {
  assigned: "Assigned", draft: "Draft saved", submitted: "Submitted", late: "Late", graded: "Graded",
};

export default function StudentAssignmentDetail() {
  const { classId, id } = useRouteIds("classId", "id");
  const toast = useToast();
  const { data: assignment, loading, error, refetch } = useAssignment(classId, id);
  const attach = useAttachAssignment(classId ?? "", id ?? "");
  const turnIn = useTurnInAssignment(classId ?? "", id ?? "");
  const filePicker = useFilePicker();

  const [text, setText] = useState("");
  const [file, setFile] = useState<Attachment | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Reset the form when a different (or freshly loaded) assignment arrives — adjusted during
  // render, per https://react.dev/learn/you-might-not-need-an-effect, not in a useEffect.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (assignment && assignment.id !== loadedId) {
    setLoadedId(assignment.id);
    setText(assignment.submissionText ?? "");
    setFile(assignment.submissionFile ?? null);
  }

  const editable = assignment?.status === "assigned";
  const dirty = editable && (text.trim().length > 0 || !!file);
  const fallback = classId ? { pathname: "/student/course-detail" as const, params: { id: classId } } : "/student/courses";
  const goBack = useSafeBack(fallback, { blocked: dirty, onBlocked: () => setConfirmDiscard(true) });
  const forceBack = useForceBack(fallback);

  const pickFile = async () => {
    const picked = await filePicker.pick();
    if (picked) setFile(picked);
    else if (filePicker.error) toast.show(filePicker.error, { tone: "red" });
  };

  const submit = async () => {
    const validation = validateSubmissionText(text, !file);
    if (validation) {
      toast.show(validation, { tone: "red" });
      return;
    }
    const result = await attach.run({ text, file });
    if (!result.ok) {
      toast.show(result.error.message, { tone: "red" });
      return;
    }
    toast.show(result.value.status === "draft" ? "Saved as draft" : "Turned in", { tone: "green" });
  };

  const turnInDraft = async () => {
    const result = await turnIn.run(undefined);
    toast.show(result.ok ? "Turned in" : result.error.message, { tone: result.ok ? "green" : "red" });
  };

  return (
    <Screen role="student" scope="student/assignment-detail">
      <PageTitle title={assignment?.title ?? "Assignment"} onBack={goBack} />
      <ListState
        loading={loading}
        error={error}
        empty={!loading && !assignment}
        onRetry={refetch}
        emptyIcon="document-text-outline"
        emptyTitle="Assignment not found"
      >
        {assignment ? (
          <View style={{ gap: SPACE.lg }}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: SPACE.sm }}>
                <Text style={TYPE.h3} numberOfLines={1}>{assignment.points} points</Text>
                <Badge label={STATUS_LABEL[assignment.status]} tone={STATUS_TONE[assignment.status]} />
              </View>
              <Text style={[TYPE.muted, { marginTop: 4 }]}>{dueLabel(assignment.dueAt)}</Text>
              <Text style={[TYPE.body, { marginTop: SPACE.sm }]}>{assignment.instructions}</Text>
            </Card>

            {assignment.attachments.length > 0 ? (
              <View style={{ gap: SPACE.sm }}>
                <Text style={TYPE.label}>Brief</Text>
                {assignment.attachments.map((a) => <AttachmentRow key={a.id} attachment={a} />)}
              </View>
            ) : null}

            {assignment.status === "graded" ? (
              <Card>
                <Text style={TYPE.label}>Your grade</Text>
                <Text style={[TYPE.h1, { marginTop: 4 }]}>
                  {assignment.score}/{assignment.points}
                </Text>
                <Badge
                  label={`${toPercent(assignment.score!, assignment.points)}%`}
                  tone={scoreTone(toPercent(assignment.score!, assignment.points))}
                />
                {assignment.feedback ? <Text style={[TYPE.muted, { marginTop: SPACE.sm }]}>{assignment.feedback}</Text> : null}
              </Card>
            ) : null}

            {assignment.status === "submitted" || assignment.status === "late" ? (
              <View style={{ gap: SPACE.sm }}>
                <Text style={TYPE.label}>Your submission</Text>
                {assignment.submissionText ? <Text style={TYPE.body}>{assignment.submissionText}</Text> : null}
                {assignment.submissionFile ? <AttachmentRow attachment={assignment.submissionFile} /> : null}
              </View>
            ) : null}

            {assignment.status === "draft" ? (
              <View style={{ gap: SPACE.md }}>
                <Badge label="Not allowed late — saved as a draft until you turn it in" tone="orange" />
                {assignment.submissionText ? <Text style={TYPE.body}>{assignment.submissionText}</Text> : null}
                {assignment.submissionFile ? <AttachmentRow attachment={assignment.submissionFile} /> : null}
                <ActionButton label="Turn in" icon="checkmark-circle-outline" loading={turnIn.loading} onPress={turnInDraft} />
              </View>
            ) : null}

            {editable ? (
              <View style={{ gap: SPACE.md }}>
                <FormField
                  label="Note (optional if attaching a file)"
                  value={text}
                  onChangeText={setText}
                  multiline
                  maxLength={4000}
                />
                {file ? <AttachmentRow attachment={file} onPress={() => setFile(null)} /> : null}
                <ActionButton label={file ? "Replace file" : "Attach file"} icon="attach-outline" variant="secondary" onPress={pickFile} />
                <ActionButton label="Turn in" icon="send-outline" loading={attach.loading} onPress={submit} />
              </View>
            ) : null}
          </View>
        ) : null}
      </ListState>

      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard this submission?"
        message="Your note and attached file have not been turned in yet."
        confirmLabel="Discard"
        onConfirm={() => {
          setConfirmDiscard(false);
          forceBack();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </Screen>
  );
}
