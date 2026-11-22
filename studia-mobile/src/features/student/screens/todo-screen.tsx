// todo-screen.tsx — auto-generated checklist from assignments + quizzes. The tab strip stays on
// top on its own; sorting/filtering lives in a bottom "Filter & sort" sheet.
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  AppList,
  BottomSheet,
  Chip,
  ListState,
  PageTitle,
  ProgressBar,
  SegmentedTabs,
} from "@/shared/components/ui";
import { AppButton } from "@/shared/components/ui/app-button";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { TaskRow } from "@/features/student/components/task-row";
import { useTasks, useToggleTask } from "@/features/student/hooks/use-tasks";
import {
  DEFAULT_TASK_FILTER,
  TASK_TABS,
  applyTaskFilter,
  isFilterActive,
  type TaskFilter,
  type TaskTab,
} from "@/features/student/logic/task-filters";
import type { Task } from "@/features/student/types/student";

export default function StudentTodo() {
  const router = useRouter();
  const goBack = useSafeBack("/student/home");
  const { data, loading, error, refetch } = useTasks();
  const toggleTask = useToggleTask();
  const [tab, setTab] = useState<TaskTab>("Today");
  const [filter, setFilter] = useState<TaskFilter>(DEFAULT_TASK_FILTER);
  const [sheetOpen, setSheetOpen] = useState(false);

  const tasks = useMemo(() => data ?? [], [data]);
  const doneCount = useMemo(() => tasks.filter((t) => t.done).length, [tasks]);
  const classes = useMemo(() => {
    const seen = new Map<string, string>();
    tasks.forEach((t) => seen.set(t.classId, t.classCode));
    return [...seen.entries()].map(([id, code]) => ({ id, code }));
  }, [tasks]);

  const filtered = useMemo(() => applyTaskFilter(tasks, tab, filter), [tasks, tab, filter]);

  const toggle = useCallback((id: string) => void toggleTask.run(id), [toggleTask]);

  const openTask = useCallback(
    (task: Task) =>
      router.push(
        task.kind === "assignment"
          ? { pathname: "/student/assignment-detail", params: { classId: task.classId, id: task.refId } }
          : task.done
            ? { pathname: "/student/quiz-result", params: { classId: task.classId, quizId: task.refId } }
            : { pathname: "/student/quiz-take", params: { classId: task.classId, quizId: task.refId } },
      ),
    [router],
  );

  const renderRow = useCallback(
    (task: Task) => (
      <TaskRow task={task} onToggle={() => toggle(task.id)} onPress={() => openTask(task)} />
    ),
    [toggle, openTask],
  );

  const patch = useCallback((p: Partial<TaskFilter>) => setFilter((f) => ({ ...f, ...p })), []);
  const active = isFilterActive(filter);

  return (
    <Screen role="student" scroll={false} scope="student/todo">
      <PageTitle title="To-do" onBack={goBack} />
      <ProgressBar
        value={tasks.length ? doneCount / tasks.length : 0}
        label={`${doneCount}/${tasks.length} done`}
      />
      <SegmentedTabs items={TASK_TABS} value={tab} onChange={setTab} label="Task filter" />

      <View style={s.fill}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && filtered.length === 0}
          onRetry={refetch}
          emptyIcon="checkmark-done-outline"
          emptyTitle="Nothing here"
          emptyMessage="You're all caught up for this filter."
        >
          <AppList data={filtered} renderRow={renderRow} refreshing={loading} onRefresh={refetch} />
        </ListState>
      </View>

      <AppButton
        label={active ? "Filter & sort · active" : "Filter & sort"}
        variant="secondary"
        onPress={() => setSheetOpen(true)}
      />

      <BottomSheet visible={sheetOpen} title="Filter & sort" onClose={() => setSheetOpen(false)}>
        <Text style={TYPE.label}>Sort</Text>
        <View style={s.chips}>
          <Chip label="Soonest due" selected={filter.sort === "soonest"} onPress={() => patch({ sort: "soonest" })} />
          <Chip label="Latest due" selected={filter.sort === "latest"} onPress={() => patch({ sort: "latest" })} />
        </View>
        <Text style={TYPE.label}>Show</Text>
        <View style={s.chips}>
          <Chip label="All types" selected={filter.kind === "all"} onPress={() => patch({ kind: "all" })} />
          <Chip label="Assignments" selected={filter.kind === "assignment"} onPress={() => patch({ kind: "assignment" })} />
          <Chip label="Quizzes" selected={filter.kind === "quiz"} onPress={() => patch({ kind: "quiz" })} />
        </View>
        <Text style={TYPE.label}>Class</Text>
        <View style={s.chips}>
          <Chip label="All classes" selected={filter.classId === "all"} onPress={() => patch({ classId: "all" })} />
          {classes.map((c) => (
            <Chip key={c.id} label={c.code} selected={filter.classId === c.id} onPress={() => patch({ classId: c.id })} />
          ))}
        </View>
        <AppButton label="Reset" variant="secondary" onPress={() => setFilter(DEFAULT_TASK_FILTER)} />
        <AppButton label="Done" onPress={() => setSheetOpen(false)} />
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
});
