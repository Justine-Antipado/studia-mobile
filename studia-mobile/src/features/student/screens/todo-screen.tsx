// todo-screen.tsx — auto-generated checklist from the assignments and quizzes of the classes the
// student joined (the `student_tasks` view: posting a quiz or an activity creates the to-do by
// itself, G3). G4: no filter and no sort — the bucket dropdown is the only control and the list is
// always soonest due first.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppList, FilterPillSheet, ListState, PageTitle, ProgressBar, type FilterGroup } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { TaskRow } from "@/features/student/components/task-row";
import { useTasks, useToggleTask } from "@/features/student/hooks/use-tasks";
import { TASK_TABS, tasksForTab, type TaskTab } from "@/features/student/logic/task-filters";
import type { Task } from "@/features/student/types/student";

const FILTER_GROUPS: FilterGroup[] = [
  { key: "tab", title: "Show", options: TASK_TABS.map((t) => ({ value: t, label: t })) },
];
const DEFAULT_FILTERS = { tab: "Today" };

const EMPTY_MESSAGE: Record<TaskTab, string> = {
  Today: "Nothing due today. Check Upcoming for what is next.",
  Upcoming: "No upcoming work. Your instructors have not posted anything new.",
  Overdue: "Nothing overdue. Keep it up.",
  Done: "Nothing finished yet. Completed work moves here automatically.",
};

export default function StudentTodo() {
  const router = useSafeRouter();
  const goBack = useSafeBack("/student/home");
  const { data, loading, error, refetch } = useTasks();
  const toggleTask = useToggleTask();
  const [tab, setTab] = useState<TaskTab>("Today");

  const tasks = useMemo(() => data ?? [], [data]);
  const doneCount = useMemo(() => tasks.filter((t) => t.done).length, [tasks]);
  const shown = useMemo(() => tasksForTab(tasks, tab), [tasks, tab]);

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
      <FilterPillSheet
        groups={FILTER_GROUPS}
        value={{ tab }}
        defaults={DEFAULT_FILTERS}
        onApply={(next) => setTab(next.tab as TaskTab)}
      />

      <View style={s.fill}>
        <ListState
          loading={loading}
          error={error}
          empty={!loading && shown.length === 0}
          onRetry={refetch}
          emptyIcon="checkmark-done-outline"
          emptyTitle="Nothing here"
          emptyMessage={EMPTY_MESSAGE[tab]}
        >
          <AppList data={shown} renderRow={renderRow} refreshing={loading} onRefresh={refetch} />
        </ListState>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
});
