// planner-screen.tsx — AI-generated weekly study schedule: day picker, move/mark-done blocks,
// add an exam date, and Regenerate (bypasses the cached schedule).
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import {
  ActionButton,
  BottomSheet,
  DateTimeField,
  FormField,
  ListRow,
  ListState,
  PageTitle,
  SegmentedTabs,
  useToast,
  type IconName,
} from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { PlannerBlockCard } from "@/features/student/components/planner-block-card";
import { addDaysIso, dayChipLabel, dayLabel, toLocalIso, weekdayShort } from "@/features/student/logic/format";
import {
  useAddExam,
  useMarkBlockDone,
  useMoveBlock,
  usePlanner,
  useRegeneratePlanner,
} from "@/features/student/hooks/use-planner";
import type { PlannerEventKind } from "@/features/student/types/student";

const EVENT_ICON: Record<PlannerEventKind, IconName> = {
  assignment: "document-text-outline",
  quiz: "help-circle-outline",
  announcement: "megaphone-outline",
};

function tomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

function weekDays(startIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(startIso, i));
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
  const [examDate, setExamDate] = useState(() => tomorrow());

  const today = toLocalIso(new Date());
  const day = days.includes(selectedDay) ? selectedDay : days.includes(today) ? today : days[0] || "";
  const blocksForDay = (week?.blocks ?? []).filter((b) => b.dayIso === day).sort((a, b) => a.startHour - b.startHour);
  const eventsForDay = (week?.events ?? []).filter((e) => e.dayIso === day);

  // Every planner write reports failure (offline, missing block) instead of failing silently.
  const run = async (pending: Promise<{ ok: boolean; error?: { message: string } }>, success?: string) => {
    const r = await pending;
    if (!r.ok) toast.show(r.error?.message ?? "Something went wrong.", { tone: "red" });
    else if (success) toast.show(success, { tone: "green" });
  };

  const submitExam = async () => {
    if (!examTitle.trim()) {
      toast.show("Enter the exam title.", { tone: "red" });
      return;
    }
    const dateIso = toLocalIso(examDate);
    if (dateIso < today) {
      toast.show("The exam date can't be in the past.", { tone: "red" });
      return;
    }
    const result = await addExam.run({ title: examTitle.trim(), dateIso });
    if (result.ok) {
      setAddingExam(false);
      setExamTitle("");
      setExamDate(tomorrow());
      toast.show("Exam added. Revision blocks were scheduled.", { tone: "green" });
    } else {
      toast.show(result.error.message, { tone: "red" });
    }
  };

  return (
    <Screen role="student" scope="student/planner">
      <PageTitle title="Study Planner" onBack={goBack} />
      <ListState loading={loading} error={error} empty={!loading && !week} onRetry={refetch} emptyIcon="calendar-outline" emptyTitle="No plan yet">
        {week ? (
          <View style={{ gap: SPACE.lg }}>
            <SegmentedTabs items={days} value={day} onChange={setSelectedDay} formatLabel={dayChipLabel} label="Days" />
            <Text style={TYPE.h2}>{dayLabel(day)}</Text>

            {/* G6: what is actually happening on this day — due assignments and quizzes, and
                announcements posted that day. Read-only: they come from the class. */}
            {eventsForDay.length > 0 ? (
              <View style={{ gap: SPACE.sm }}>
                <Text style={TYPE.label}>On this day</Text>
                {eventsForDay.map((e) => (
                  <ListRow
                    key={e.id}
                    flat
                    icon={EVENT_ICON[e.kind]}
                    eyebrow={e.classCode}
                    title={e.title}
                    subtitle={e.timeLabel}
                  />
                ))}
              </View>
            ) : null}

            {blocksForDay.length === 0 ? (
              <Text style={TYPE.muted}>No study blocks for this day.</Text>
            ) : (
              <View style={{ gap: SPACE.sm }}>
                {blocksForDay.map((b) => (
                  <PlannerBlockCard
                    key={b.id}
                    block={b}
                    onToggleDone={() => void run(markDone.run({ id: b.id, done: !b.done }))}
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
              onPress={() => void run(regenerate.run(undefined), "Schedule regenerated")}
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
                if (movingBlockId) {
                  const block = week?.blocks.find((x) => x.id === movingBlockId);
                  void run(moveBlock.run({ id: movingBlockId, dayIso: d, startHour: block?.startHour ?? 16 }));
                }
                setMovingBlockId(null);
              }}
            />
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={addingExam} title="Add exam date" onClose={() => setAddingExam(false)}>
        <FormField label="Exam title" value={examTitle} onChangeText={setExamTitle} placeholder="e.g. Midterm Exam" />
        <DateTimeField label="Exam date" mode="date" value={examDate} onChange={setExamDate} minimumDate={new Date()} />
        <ActionButton label="Add exam" icon="checkmark" loading={addExam.loading} onPress={submitExam} />
      </BottomSheet>
    </Screen>
  );
}
