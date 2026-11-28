// add-plan-sheet.tsx — bottom sheet to add a plan to the Study Planner, or edit/delete an
// existing one (opened with the block itself, already in hand from the list — no route, no id
// lookup). A plan carries notes, a time range and a priority.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionButton, BottomSheet, ConfirmDialog, FormField, useToast } from "@/shared/components/ui";
import { C, TONES, type Tone } from "@/shared/constants/studia-colors";
import { FONT, SPACE, TYPE } from "@/shared/constants/tokens";
import { toLocalIso } from "@/features/student/logic/format";
import { DateHourRangeField } from "@/features/student/components/date-hour-range-field";
import { useAddPlan, useDeleteBlock, useUpdatePlan } from "@/features/student/hooks/use-planner";
import type { PlannerBlock, PlannerPriority } from "@/features/student/types/student";

const PRIORITIES: { value: PlannerPriority; label: string; tone: Tone }[] = [
  { value: "high", label: "High", tone: "red" },
  { value: "medium", label: "Medium", tone: "blue" },
  { value: "low", label: "Low", tone: "green" },
];

export function AddPlanSheet({
  visible,
  editingBlock,
  onClose,
}: {
  visible: boolean;
  /** The block to edit, already loaded by the planner list — null means "add a new plan". */
  editingBlock: PlannerBlock | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const addPlan = useAddPlan();
  const updatePlan = useUpdatePlan();
  const deleteBlock = useDeleteBlock();

  const isEdit = !!editingBlock;
  const today = toLocalIso(new Date());

  const [dayIso, setDayIso] = useState(today);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<PlannerPriority>("medium");
  const [fromHour, setFromHour] = useState(9);
  const [toHour, setToHour] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-seed the form every time the sheet opens, for whichever block (or blank "add") it opened
  // with — the sheet stays mounted between opens, unlike the old routed screen. Adjusted during
  // render (react.dev/learn/you-might-not-need-an-effect) rather than in an effect, so there's no
  // extra render showing stale fields from the previous open.
  const openSignature = visible ? (editingBlock ? `edit:${editingBlock.id}` : "add") : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (!visible) {
    // Closed: forget what was seeded, so the next open (even for the same block) re-seeds
    // instead of showing whatever was left dirty from before.
    if (seededFor !== null) setSeededFor(null);
  } else if (openSignature !== seededFor) {
    setSeededFor(openSignature);
    setConfirmDelete(false);
    if (editingBlock) {
      setDayIso(editingBlock.dayIso);
      setTitle(editingBlock.title);
      setNotes(editingBlock.notes);
      setPriority(editingBlock.priority);
      setFromHour(editingBlock.startHour);
      setToHour(editingBlock.startHour + editingBlock.durationHours);
    } else {
      setDayIso(toLocalIso(new Date()));
      setTitle("");
      setNotes("");
      setPriority("medium");
      setFromHour(9);
      setToHour(10);
    }
  }

  const loading = isEdit ? updatePlan.loading : addPlan.loading;

  const submit = async () => {
    if (!title.trim()) {
      toast.show("Enter a title for the plan.", { tone: "red" });
      return;
    }
    // A new plan (or a moved date) can't be in the past, but an existing plan stays editable on
    // its own old date, so notes / priority / title can still be fixed after it is overdue.
    if (dayIso < today && !(editingBlock && dayIso === editingBlock.dayIso)) {
      toast.show("The plan date can't be in the past.", { tone: "red" });
      return;
    }
    if (toHour <= fromHour) {
      toast.show("The end time must be after the start time.", { tone: "red" });
      return;
    }

    const start = fromHour;
    const durationHours = Math.min(24 - start, toHour - start);

    if (isEdit && editingBlock) {
      const result = await updatePlan.run({
        id: editingBlock.id,
        dayIso,
        title: title.trim(),
        notes: notes.trim(),
        priority,
        startHour: start,
        durationHours,
      });
      if (result.ok) {
        toast.show("Plan updated.", { tone: "green" });
        onClose();
      } else {
        toast.show(result.error.message, { tone: "red" });
      }
      return;
    }

    const result = await addPlan.run({ dayIso, title: title.trim(), notes: notes.trim(), priority, startHour: start, durationHours });
    if (result.ok) {
      toast.show("Plan added.", { tone: "green" });
      onClose();
    } else {
      toast.show(result.error.message, { tone: "red" });
    }
  };

  const remove = async () => {
    if (!editingBlock) return;
    const result = await deleteBlock.run(editingBlock.id);
    setConfirmDelete(false);
    if (result.ok) {
      toast.show("Plan deleted.", { tone: "green" });
      onClose();
    } else {
      toast.show(result.error.message, { tone: "red" });
    }
  };

  return (
    <BottomSheet visible={visible} title={isEdit ? "Edit plan" : "Add plan"} onClose={onClose}>
      <DateHourRangeField
        label="Date"
        value={new Date(`${dayIso}T00:00:00`)}
        onChange={(d) => setDayIso(toLocalIso(d))}
        minimumDate={editingBlock && editingBlock.dayIso < today ? new Date(`${editingBlock.dayIso}T00:00:00`) : new Date()}
        fromHour={fromHour}
        toHour={toHour}
        onFromHourChange={setFromHour}
        onToHourChange={setToHour}
      />

      <FormField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Read Chapter 4" required />

      <FormField label="Add Details" value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline />

      <View style={{ gap: SPACE.xs + 2 }}>
        <Text style={TYPE.label}>Choose Priority</Text>
        <View style={s.priorityRow}>
          {PRIORITIES.map((p) => {
            const selected = p.value === priority;
            const tone = TONES[p.tone];
            return (
              <Pressable
                key={p.value}
                onPress={() => setPriority(p.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[s.priorityPill, { backgroundColor: selected ? tone.fg : tone.bg, borderColor: tone.border }]}
              >
                <Text style={[s.priorityText, { color: selected ? C.white : tone.strong }]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ActionButton label={isEdit ? "Save changes" : "Add plan"} icon="checkmark" loading={loading} onPress={submit} />

      {isEdit ? (
        <ActionButton label="Delete plan" icon="trash-outline" variant="danger" onPress={() => setConfirmDelete(true)} />
      ) : null}

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this plan?"
        message="This can't be undone."
        confirmLabel="Delete"
        busy={deleteBlock.loading}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  priorityRow: { flexDirection: "row", gap: SPACE.sm },
  priorityPill: { flex: 1, alignItems: "center", paddingVertical: SPACE.sm + 2, borderRadius: 999, borderWidth: 1 },
  priorityText: { fontFamily: FONT.semibold, fontSize: 13 },
});
