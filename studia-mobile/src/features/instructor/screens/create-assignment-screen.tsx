// create-assignment-screen.tsx — modal: title, instructions, due date, points, allow-late,
// attachments (docs/UI-BRIEF Assignment create).
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Chip, ConfirmDialog, FormField, PageTitle, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteId } from "@/core/logic/route-params";
import { useForceBack, useSafeBack } from "@/shared/hooks/use-safe-back";
import { AttachmentRow } from "@/shared/components/ui/attachment-row";
import { useCreateAssignment } from "@/features/instructor/hooks/use-assignments";
import { useFilePicker } from "@/features/instructor/hooks/use-file-picker";
import { validateAssignmentInstructions, validateAssignmentTitle, validatePoints } from "@/features/instructor/logic/validators";
import type { Attachment } from "@/features/instructor/types/instructor";

const DUE_PRESETS = [
  { label: "Tomorrow", hours: 24 },
  { label: "In 3 days", hours: 72 },
  { label: "Next week", hours: 168 },
];

export default function CreateAssignmentScreen() {
  const classId = useRouteId("classId");
  const router = useRouter();
  const toast = useToast();
  const create = useCreateAssignment(classId ?? "");
  const filePicker = useFilePicker();

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [points, setPoints] = useState("10");
  const [allowLate, setAllowLate] = useState(true);
  const [dueHours, setDueHours] = useState(24);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [errors, setErrors] = useState<{ title?: string | null; instructions?: string | null; points?: string | null }>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dirty = title.trim().length > 0 || instructions.trim().length > 0;
  const fallback = classId ? { pathname: "/instructor/class-detail" as const, params: { id: classId } } : "/instructor/classes";
  const goBack = useSafeBack(fallback, { blocked: dirty, onBlocked: () => setConfirmDiscard(true) });
  const forceBack = useForceBack(fallback);

  const pickFile = async () => {
    const picked = await filePicker.pick();
    if (picked) setAttachments((prev) => [...prev, picked]);
    else if (filePicker.error) toast.show(filePicker.error, { tone: "red" });
  };

  const submit = async () => {
    const titleError = validateAssignmentTitle(title);
    const instructionsError = validateAssignmentInstructions(instructions);
    const pointsError = validatePoints(points);
    setErrors({ title: titleError, instructions: instructionsError, points: pointsError });
    if (titleError || instructionsError || pointsError || !classId) return;

    const result = await create.run({
      title,
      instructions,
      dueAt: new Date(Date.now() + dueHours * 3_600_000).toISOString(),
      points: Number(points),
      allowLate,
      attachments,
    });
    if (result.ok) {
      toast.show("Assignment created", { tone: "green" });
      router.replace({ pathname: "/instructor/class-detail", params: { id: classId } });
    } else {
      toast.show(result.error.message, { tone: "red" });
    }
  };

  return (
    <Screen role="instructor" scope="instructor/create-assignment">
      <PageTitle title="Create Assignment" onBack={goBack} />

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
        <Text style={TYPE.label}>Due</Text>
        <View style={{ flexDirection: "row", gap: SPACE.sm }}>
          {DUE_PRESETS.map((p) => (
            <Chip key={p.hours} label={p.label} selected={dueHours === p.hours} onPress={() => setDueHours(p.hours)} />
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

      <View style={{ gap: SPACE.sm }}>
        <Text style={TYPE.label}>Late submissions</Text>
        <View style={{ flexDirection: "row", gap: SPACE.sm }}>
          <Chip label="Allowed (tagged Late)" selected={allowLate} onPress={() => setAllowLate(true)} />
          <Chip label="Not allowed (stays a draft)" selected={!allowLate} onPress={() => setAllowLate(false)} />
        </View>
      </View>

      <View style={{ gap: SPACE.sm }}>
        <Text style={TYPE.label}>Attachments</Text>
        {attachments.map((a) => (
          <AttachmentRow key={a.id} attachment={a} onPress={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))} />
        ))}
        <ActionButton label="Attach file" icon="attach-outline" variant="secondary" onPress={pickFile} />
      </View>

      <ActionButton label="Create assignment" icon="checkmark" loading={create.loading} onPress={submit} />

      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard this assignment?"
        message="Your draft has not been created yet."
        confirmLabel="Discard"
        onConfirm={() => { setConfirmDiscard(false); forceBack(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </Screen>
  );
}
