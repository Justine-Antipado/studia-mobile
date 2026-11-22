// assignment-form.tsx — the ONE form for creating and editing an assignment.
//   create: blank form, due defaults to tomorrow 11:59 PM, due cannot be in the past.
//   edit:   preloaded from the existing assignment INCLUDING its attachments (the repository
//           replaces the attachment list, so dropping them here would delete them), due may be
//           moved to any date so a passed deadline can be extended.
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Chip, ConfirmDialog, DateTimeField, FormField, PageTitle, SelectField, useToast } from "@/shared/components/ui";
import { AttachmentRow } from "@/shared/components/ui/attachment-row";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useForceBack, useSafeBack } from "@/shared/hooks/use-safe-back";
import type { AssignmentDraft } from "@/features/instructor/data/assignments-repository";
import { useFilePicker } from "@/features/instructor/hooks/use-file-picker";
import { DUE_PRESETS, defaultDueDate, presetDue, validateDue } from "@/features/instructor/logic/assignment-schedule";
import { validateAssignmentInstructions, validateAssignmentTitle, validatePoints } from "@/features/instructor/logic/validators";
import type { Attachment } from "@/features/instructor/types/instructor";
import type { Href } from "expo-router";

export type AssignmentFormInitial = {
  title: string;
  instructions: string;
  dueAt: Date;
  points: number;
  allowLate: boolean;
  attachments: Attachment[];
};

const LATE_OPTIONS = [
  { value: "allowed", label: "Allowed — tagged Late", description: "Students can still turn it in after the due date." },
  { value: "blocked", label: "Not allowed — stays a draft", description: "After the due date the work is saved as a draft only." },
] as const;

export function AssignmentForm({
  mode,
  initial,
  submitLabel,
  fallback,
  discardTitle,
  onSubmit,
  loading,
}: {
  mode: "create" | "edit";
  initial?: AssignmentFormInitial;
  submitLabel: string;
  fallback: Href;
  discardTitle: string;
  onSubmit: (draft: AssignmentDraft) => Promise<{ ok: true } | { ok: false; message: string }>;
  loading: boolean;
}) {
  const toast = useToast();
  const filePicker = useFilePicker();
  const start = useMemo<AssignmentFormInitial>(
    () =>
      initial ?? { title: "", instructions: "", dueAt: defaultDueDate(), points: 10, allowLate: true, attachments: [] },
    [initial],
  );

  const [title, setTitle] = useState(start.title);
  const [instructions, setInstructions] = useState(start.instructions);
  const [points, setPoints] = useState(String(start.points));
  const [allowLate, setAllowLate] = useState<"allowed" | "blocked">(start.allowLate ? "allowed" : "blocked");
  const [due, setDue] = useState(start.dueAt);
  const [attachments, setAttachments] = useState<Attachment[]>(start.attachments);
  const [errors, setErrors] = useState<{ title?: string | null; instructions?: string | null; points?: string | null; due?: string | null }>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dirty =
    title !== start.title ||
    instructions !== start.instructions ||
    Number(points) !== start.points ||
    (allowLate === "allowed") !== start.allowLate ||
    due.getTime() !== start.dueAt.getTime() ||
    attachments.length !== start.attachments.length;

  const goBack = useSafeBack(fallback, { blocked: dirty, onBlocked: () => setConfirmDiscard(true) });
  const forceBack = useForceBack(fallback);

  const pickFile = async () => {
    const picked = await filePicker.pick();
    if (picked) setAttachments((prev) => [...prev, picked]);
    else if (filePicker.error) toast.show(filePicker.error, { tone: "red" });
  };

  const submit = async () => {
    const next = {
      title: validateAssignmentTitle(title),
      instructions: validateAssignmentInstructions(instructions),
      points: validatePoints(points),
      due: validateDue(due, mode),
    };
    setErrors(next);
    if (next.title || next.instructions || next.points || next.due) return;

    const result = await onSubmit({
      title,
      instructions,
      dueAt: due.toISOString(),
      points: Number(points),
      allowLate: allowLate === "allowed",
      attachments,
    });
    if (!result.ok) toast.show(result.message, { tone: "red" });
  };

  return (
    <Screen role="instructor" scope={`instructor/${mode}-assignment`}>
      <PageTitle title={mode === "edit" ? "Edit Assignment" : "Create Assignment"} onBack={goBack} />

      <FormField
        label="Title"
        value={title}
        onChangeText={(v) => { setTitle(v); setErrors((e) => ({ ...e, title: null })); }}
        placeholder="e.g. Firewall Rule Design Exercise"
        maxLength={100}
        error={errors.title}
      />
      <FormField
        label="Instructions"
        value={instructions}
        onChangeText={(v) => { setInstructions(v); setErrors((e) => ({ ...e, instructions: null })); }}
        placeholder="What should students submit?"
        multiline
        maxLength={4000}
        error={errors.instructions}
      />

      <View style={{ gap: SPACE.sm }}>
        <DateTimeField
          label="Due"
          value={due}
          onChange={(d) => { setDue(d); setErrors((e) => ({ ...e, due: null })); }}
          minimumDate={mode === "create" ? new Date() : undefined}
          error={errors.due}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
          {DUE_PRESETS.map((p) => (
            <Chip key={p.days} label={p.label} onPress={() => { setDue(presetDue(p.days)); setErrors((e) => ({ ...e, due: null })); }} />
          ))}
        </View>
      </View>

      <FormField
        label="Points"
        value={points}
        onChangeText={(v) => { setPoints(v); setErrors((e) => ({ ...e, points: null })); }}
        keyboardType="number-pad"
        maxLength={5}
        error={errors.points}
      />

      <SelectField label="Late submissions" value={allowLate} options={LATE_OPTIONS} onChange={setAllowLate} />

      <View style={{ gap: SPACE.sm }}>
        <Text style={TYPE.label}>Attachments</Text>
        {attachments.map((a) => (
          <AttachmentRow key={a.id} attachment={a} onPress={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))} />
        ))}
        {attachments.length > 0 ? <Text style={TYPE.caption}>Tap a file to remove it.</Text> : null}
        <ActionButton label="Attach file" icon="attach-outline" variant="secondary" onPress={pickFile} />
      </View>

      <ActionButton label={submitLabel} icon="checkmark" loading={loading} onPress={submit} />

      <ConfirmDialog
        visible={confirmDiscard}
        title={discardTitle}
        message="Your changes have not been saved."
        confirmLabel="Discard"
        onConfirm={() => { setConfirmDiscard(false); forceBack(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </Screen>
  );
}
