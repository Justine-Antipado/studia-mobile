// add-plan-screen.tsx — sheet: add a plan or an exam date to the Study Planner, or edit/delete an
// existing manual plan (opened with ?blockId=). A plan carries notes, a time range and a priority;
// an exam is just a title and a date (planner_exams has no notes/priority/time columns of its own).
// A task-derived block is never opened here — it has nothing of its own to edit.
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionButton,
  ConfirmDialog,
  DateTimeField,
  FormField,
  Icon,
  SelectField,
  useToast,
  type SelectOption,
} from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C, TONES, type Tone } from "@/shared/constants/studia-colors";
import { FONT, HIT_SLOP, MIN_TOUCH, RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { useRouteId } from "@/core/logic/route-params";
import { DateStrip } from "@/features/student/components/date-strip";
import { hourLabel, toLocalIso } from "@/features/student/logic/format";
import { useAddExam, useAddPlan, useDeleteBlock, usePlanner, useUpdatePlan } from "@/features/student/hooks/use-planner";
import type { PlannerPriority } from "@/features/student/types/student";

type Kind = "plan" | "exam";

const HOUR_OPTIONS: SelectOption<string>[] = Array.from({ length: 16 }, (_, i) => i + 6).map((h) => ({
  value: String(h),
  label: hourLabel(h),
}));

const PRIORITIES: { value: PlannerPriority; label: string; tone: Tone }[] = [
  { value: "high", label: "High", tone: "red" },
  { value: "medium", label: "Medium", tone: "blue" },
  { value: "low", label: "Low", tone: "green" },
];

export default function StudentAddPlan() {
  const goBack = useSafeBack("/student/planner");
  const toast = useToast();
  const addPlan = useAddPlan();
  const addExam = useAddExam();
  const updatePlan = useUpdatePlan();
  const deleteBlock = useDeleteBlock();

  const blockId = useRouteId("blockId");
  const { data, loading: plannerLoading } = usePlanner();
  const editing = blockId ? data?.blocks.find((b) => b.id === blockId && !b.taskId) ?? null : null;
  const isEdit = !!blockId;

  const today = toLocalIso(new Date());
  const [kind, setKind] = useState<Kind>("plan");
  const [dayIso, setDayIso] = useState(today);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<PlannerPriority>("medium");
  const [fromHour, setFromHour] = useState("9");
  const [toHour, setToHour] = useState("10");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Prefill once the edited block arrives; a ref keeps a later background refetch from clobbering
  // edits the student has already started typing.
  const seeded = useRef(false);
  useEffect(() => {
    if (!editing || seeded.current) return;
    seeded.current = true;
    setDayIso(editing.dayIso);
    setTitle(editing.title);
    setNotes(editing.notes);
    setPriority(editing.priority);
    setFromHour(String(editing.startHour));
    setToHour(String(editing.startHour + editing.durationHours));
  }, [editing]);

  const loading = isEdit ? updatePlan.loading : kind === "plan" ? addPlan.loading : addExam.loading;

  const submit = async () => {
    if (!title.trim()) {
      toast.show(`Enter a title for the ${isEdit ? "plan" : kind}.`, { tone: "red" });
      return;
    }
    if (dayIso < today) {
      toast.show(`The ${isEdit ? "plan" : kind} date can't be in the past.`, { tone: "red" });
      return;
    }

    const start = Number(fromHour);
    const durationHours = Math.max(1, Math.min(24 - start, Number(toHour) - start));

    if (isEdit && blockId) {
      const result = await updatePlan.run({
        id: blockId,
        dayIso,
        title: title.trim(),
        notes: notes.trim(),
        priority,
        startHour: start,
        durationHours,
      });
      if (result.ok) {
        toast.show("Plan updated.", { tone: "green" });
        goBack();
      } else {
        toast.show(result.error.message, { tone: "red" });
      }
      return;
    }

    if (kind === "exam") {
      const result = await addExam.run({ title: title.trim(), dateIso: dayIso });
      if (result.ok) {
        toast.show("Exam added.", { tone: "green" });
        goBack();
      } else {
        toast.show(result.error.message, { tone: "red" });
      }
      return;
    }

    const result = await addPlan.run({ dayIso, title: title.trim(), notes: notes.trim(), priority, startHour: start, durationHours });
    if (result.ok) {
      toast.show("Plan added.", { tone: "green" });
      goBack();
    } else {
      toast.show(result.error.message, { tone: "red" });
    }
  };

  const remove = async () => {
    if (!blockId) return;
    const result = await deleteBlock.run(blockId);
    setConfirmDelete(false);
    if (result.ok) {
      toast.show("Plan deleted.", { tone: "green" });
      goBack();
    } else {
      toast.show(result.error.message, { tone: "red" });
    }
  };

  if (isEdit && !plannerLoading && !editing) {
    return (
      <Screen role="student" scope="student/add-plan">
        <View style={s.sheetHead}>
          <View style={s.grabberSpacer} />
          <View style={s.grabber} />
          <Pressable onPress={goBack} hitSlop={HIT_SLOP} accessibilityRole="button" accessibilityLabel="Close" style={s.close}>
            <Icon name="close" size="lg" color={C.primaryDark} />
          </Pressable>
        </View>
        <Text style={TYPE.h2}>Plan not found</Text>
        <Text style={TYPE.muted}>This plan may have already been deleted.</Text>
        <ActionButton label="Go back" icon="arrow-back" onPress={goBack} />
      </Screen>
    );
  }

  return (
    <Screen role="student" scope="student/add-plan">
      <View style={s.sheetHead}>
        <View style={s.grabberSpacer} />
        <View style={s.grabber} />
        <Pressable onPress={goBack} hitSlop={HIT_SLOP} accessibilityRole="button" accessibilityLabel="Close" style={s.close}>
          <Icon name="close" size="lg" color={C.primaryDark} />
        </Pressable>
      </View>

      {!isEdit ? (
        <View style={s.kindRow}>
          {(["plan", "exam"] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === k }}
              style={[s.kindPill, kind === k && s.kindPillOn]}
            >
              <Text style={[s.kindText, kind === k && s.kindTextOn]}>{k === "plan" ? "Plan" : "Exam"}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <DateTimeField
        label="Date"
        mode="date"
        value={new Date(`${dayIso}T00:00:00`)}
        onChange={(d) => setDayIso(toLocalIso(d))}
        minimumDate={new Date()}
      />
      <DateStrip selectedIso={dayIso} onSelect={setDayIso} />

      {kind === "plan" || isEdit ? (
        <View style={s.timeRow}>
          <View style={s.timeField}>
            <SelectField label="From" value={fromHour} options={HOUR_OPTIONS} onChange={setFromHour} />
          </View>
          <View style={s.timeField}>
            <SelectField label="To" value={toHour} options={HOUR_OPTIONS} onChange={setToHour} />
          </View>
        </View>
      ) : null}

      <FormField
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder={kind === "plan" || isEdit ? "e.g. Read Chapter 4" : "e.g. Midterm Exam"}
        required
      />

      {kind === "plan" || isEdit ? (
        <>
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
        </>
      ) : null}

      <ActionButton
        label={isEdit ? "Save changes" : kind === "plan" ? "Add plan" : "Add exam"}
        icon="checkmark"
        loading={loading}
        onPress={submit}
      />

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
    </Screen>
  );
}

const s = StyleSheet.create({
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  grabberSpacer: { width: MIN_TOUCH - 8 },
  grabber: { width: 42, height: 4, borderRadius: 2, backgroundColor: C.lavender },
  close: {
    width: MIN_TOUCH - 8,
    height: MIN_TOUCH - 8,
    borderRadius: RADIUS.pill,
    backgroundColor: C.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  kindRow: { flexDirection: "row", gap: SPACE.sm },
  kindPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACE.sm + 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  kindPillOn: { backgroundColor: C.primary, borderColor: C.primary },
  kindText: { color: C.text, fontFamily: FONT.semibold },
  kindTextOn: { color: C.white },
  timeRow: { flexDirection: "row", gap: SPACE.md },
  timeField: { flex: 1 },
  priorityRow: { flexDirection: "row", gap: SPACE.sm },
  priorityPill: { flex: 1, alignItems: "center", paddingVertical: SPACE.sm + 2, borderRadius: 999, borderWidth: 1 },
  priorityText: { fontFamily: FONT.semibold, fontSize: 13 },
});
