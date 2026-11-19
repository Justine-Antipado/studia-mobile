// todo-screen.tsx — auto-generated checklist from assignments + quizzes, with filters/sort.
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppList, Icon, ListState, PageTitle, ProgressBar, SegmentedTabs } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import { HIT_SLOP, SPACE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { TaskRow } from "@/features/student/components/task-row";
import { isOverdue } from "@/features/student/logic/format";
import { useTasks, useToggleTask } from "@/features/student/hooks/use-tasks";
import type { Task } from "@/features/student/types/student";

const FILTERS = ["Today", "Upcoming", "Overdue", "Done"] as const;
type Filter = (typeof FILTERS)[number];

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

function matches(task: Task, filter: Filter): boolean {
  if (filter === "Done") return task.done;
  if (task.done) return false;
  if (filter === "Overdue") return isOverdue(task.dueAt);
  if (filter === "Today") return isToday(task.dueAt);
  return !isOverdue(task.dueAt) && !isToday(task.dueAt);
}

export default function StudentTodo() {
  const router = useRouter();
  const goBack = useSafeBack("/student/home");
  const { data, loading, error, refetch } = useTasks();
  const toggleTask = useToggleTask();
  const [filter, setFilter] = useState<Filter>("Today");
  const [descending, setDescending] = useState(false);

  // Memoized so the derived lists below do not recompute (and re-render every row) on a render
  // that changed nothing but, say, the sort toggle.
  const tasks = useMemo(() => data ?? [], [data]);
  const doneCount = useMemo(() => tasks.filter((t) => t.done).length, [tasks]);

  const filtered = useMemo(
    () =>
      tasks
        .filter((t) => matches(t, filter))
        .sort((a, b) => (descending ? b.dueAt.localeCompare(a.dueAt) : a.dueAt.localeCompare(b.dueAt))),
    [tasks, filter, descending],
  );

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

  return (
    <Screen role="student" scroll={false} scope="student/todo">
      <PageTitle title="To-do" onBack={goBack} />
      <ProgressBar
        value={tasks.length ? doneCount / tasks.length : 0}
        label={`${doneCount}/${tasks.length} done`}
      />
      <View style={s.filterRow}>
        <View style={s.fill}>
          <SegmentedTabs items={FILTERS} value={filter} onChange={setFilter} />
        </View>
        <Pressable
          onPress={() => setDescending((d) => !d)}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={descending ? "Sort soonest first" : "Sort latest first"}
        >
          <Icon name={descending ? "arrow-down-outline" : "arrow-up-outline"} size="lg" color={C.primaryDark} />
        </Pressable>
      </View>

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
    </Screen>
  );
}

const s = StyleSheet.create({
  filterRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  fill: { flex: 1 },
});
