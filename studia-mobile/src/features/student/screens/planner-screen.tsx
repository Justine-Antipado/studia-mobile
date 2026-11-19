// planner-screen.tsx — AI-generated weekly study schedule: day picker, move/mark-done blocks,
// add an exam date, and Regenerate (bypasses the cached schedule).
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import {
  ActionButton,
  BottomSheet,
  FormField,
  ListRow,
  ListState,
  PageTitle,
  SegmentedTabs,
  useToast,
} from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { PlannerBlockCard } from "@/features/student/components/planner-block-card";
import { dayLabel, weekdayShort } from "@/features/student/logic/format";
import {
  useAddExam,
  useMarkBlockDone,
  useMoveBlock,
  usePlanner,
  useRegeneratePlanner,
} from "@/features/student/hooks/use-planner";

function weekDays(weekStartIso: string): string[] {
  const start = new Date(`${weekStartIso}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export default function StudentPlanner() {
  const goBack = useSafeBack("/student/home");
  const toast = useToast();
  const { data: week, loading, error, refetch } = usePlanner();
  const moveBlock = useMoveBlock();
  const markDone = useMarkBlockDone();
  const addExam = useAddExam();
  const regenerate = useRegeneratePlanner();

  const days = useMemo(() => (week ? weekDays(week.weekStartIso) : []), [week]);
  const [selectedDay, setSelectedDay] = useState<string>(days[0] ?? "");
  const [movingBlockId, setMovingBlockId] = useState<string | null>(null);
  const [addingExam, setAddingExam] = useState(false);
  const [examTitle, setExamTitle] = useState("");
  const [examDate, setExamDate] = useState("");

  const day = selectedDay || days[0] || "";
  const blocksForDay = (week?.blocks ?? []).filter((b) => b.dayIso === day).sort((a, b) => a.startHour - b.startHour);

  const submitExam = async () => {
    if (!examTitle.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
      toast.show("Enter a title and a date like 2026-12-01.", { tone: "red" });
      return;
    }
    const result = await addExam.run({ title: examTitle.trim(), dateIso: examDate });
    if (result.ok) {
      setAddingExam(false);
      setExamTitle("");
      setExamDate("");
      toast.show("Exam added", { tone: "green" });
    }
  };

  return (
    <Screen role="student" scope="student/planner">
      <PageTitle title="Study Planner" onBack={goBack} />
      <ListState loading={loading} error={error} empty={!loading && !week} onRetry={refetch} emptyIcon="calendar-outline" emptyTitle="No plan yet">
        {week ? (
          <View style={{ gap: SPACE.lg }}>
            <SegmentedTabs items={days} value={day} onChange={setSelectedDay} />
            <Text style={TYPE.h2}>{dayLabel(day)}</Text>

            {blocksForDay.length === 0 ? (
              <Text style={TYPE.muted}>No study blocks for this day.</Text>
            ) : (
              <View style={{ gap: SPACE.sm }}>
                {blocksForDay.map((b) => (
                  <PlannerBlockCard
                    key={b.id}
                    block={b}
                    onToggleDone={() => void markDone.run({ id: b.id, done: !b.done })}
                    onMove={() => setMovingBlockId(b.id)}
                  />
                ))}
              </View>
            )}

            {week.exams.length > 0 ? (
              <View style={{ gap: SPACE.sm }}>
                <Text style={TYPE.label}>Exams</Text>
                {week.exams.map((e) => (
                  <ListRow key={e.id} icon="school-outline" title={e.title} subtitle={e.dateIso} flat />
                ))}
              </View>
            ) : null}

            <ActionButton label="Add exam date" icon="add-circle-outline" variant="secondary" onPress={() => setAddingExam(true)} />
            <ActionButton
              label="Regenerate schedule"
              icon="sparkles-outline"
              variant="secondary"
              loading={regenerate.loading}
              onPress={() => void regenerate.run(undefined)}
            />
          </View>
        ) : null}
      </ListState>

      <BottomSheet visible={!!movingBlockId} title="Move to another day" onClose={() => setMovingBlockId(null)}>
        <View style={{ gap: SPACE.sm }}>
          {days.map((d) => (
            <ListRow
              key={d}
              icon="calendar-outline"
              title={dayLabel(d)}
              subtitle={weekdayShort(d)}
              onPress={() => {
                if (movingBlockId) void moveBlock.run({ id: movingBlockId, dayIso: d, startHour: 16 });
                setMovingBlockId(null);
              }}
            />
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={addingExam} title="Add exam date" onClose={() => setAddingExam(false)}>
        <FormField label="Exam title" value={examTitle} onChangeText={setExamTitle} placeholder="e.g. Midterm Exam" />
        <FormField label="Date" value={examDate} onChangeText={setExamDate} placeholder="2026-12-01" helper="Format: YYYY-MM-DD" />
        <ActionButton label="Add exam" icon="checkmark" loading={addExam.loading} onPress={submitExam} />
      </BottomSheet>
    </Screen>
  );
}
