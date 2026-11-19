// home-screen.tsx — greeting, quick actions, today's tasks, upcoming deadlines, continue learning.
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, ListRow, QuickAction, SectionHeader } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import { HIT_SLOP, SPACE, TYPE } from "@/shared/constants/tokens";
import { displayName, useRoleUser } from "@/core/data/storage/session-store";
import { ClassCard } from "@/features/student/components/class-card";
import { TaskRow } from "@/features/student/components/task-row";
import { dueLabel, isOverdue } from "@/features/student/logic/format";
import { useClasses } from "@/features/student/hooks/use-classes";
import { useTasks, useToggleTask } from "@/features/student/hooks/use-tasks";
import type { Task } from "@/features/student/types/student";

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export default function StudentHome() {
  const user = useRoleUser("student");
  const router = useRouter();
  const classes = useClasses();
  const tasks = useTasks();
  const toggleTask = useToggleTask();

  // Derived once per data change: Home re-renders on every cache notification, and these
  // feed memoized rows, so recomputing them would re-render every row for nothing.
  const { todayTasks, upcoming } = useMemo(() => {
    const pending = (tasks.data ?? []).filter((t) => !t.done);
    const today = pending.filter((t) => isToday(t.dueAt) || isOverdue(t.dueAt));
    const todayIds = new Set(today.map((t) => t.id));
    return {
      todayTasks: today.slice(0, 3),
      upcoming: pending.filter((t) => !todayIds.has(t.id)).slice(0, 3),
    };
  }, [tasks.data]);

  const continueLearning = useMemo(
    () => (classes.data ?? []).filter((c) => c.progress > 0 && c.progress < 1).slice(0, 2),
    [classes.data],
  );

  const go = useCallback((path: "search" | "courses" | "todo" | "planner" | "ai") =>
    router.push(`/student/${path}`), [router]);

  const openSearch = useCallback(() => go("search"), [go]);
  const openCourses = useCallback(() => go("courses"), [go]);
  const openTodo = useCallback(() => go("todo"), [go]);
  const openPlanner = useCallback(() => go("planner"), [go]);
  const openAi = useCallback(() => go("ai"), [go]);

  const toggle = useCallback((id: string) => void toggleTask.run(id), [toggleTask]);

  const openTask = useCallback(
    (task: Task) =>
      router.push(
        task.kind === "assignment"
          ? { pathname: "/student/assignment-detail", params: { classId: task.classId, id: task.refId } }
          : { pathname: "/student/quiz-take", params: { classId: task.classId, quizId: task.refId } },
      ),
    [router],
  );

  const openClass = useCallback(
    (id: string) => router.push({ pathname: "/student/course-detail", params: { id } }),
    [router],
  );

  return (
    <Screen
      role="student"
      scope="student/home"
      refreshing={tasks.loading && !!tasks.data}
      onRefresh={tasks.refetch}
    >
      <View style={s.greetRow}>
        <View style={s.greet}>
          <Text style={TYPE.muted}>Good day</Text>
          <Text style={TYPE.h1} numberOfLines={2}>
            {user ? displayName(user) : "Student"}
          </Text>
        </View>
        <Pressable
          onPress={openSearch}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Search courses, lessons and tasks"
        >
          <Icon name="search-outline" size="lg" color={C.primaryDark} />
        </Pressable>
      </View>

      <View style={s.actions}>
        <QuickAction icon="book-outline" label="My Courses" onPress={openCourses} />
        <QuickAction icon="checkbox-outline" label="To-do" onPress={openTodo} />
        <QuickAction icon="calendar-outline" label="Planner" tone="blue" onPress={openPlanner} />
        <QuickAction icon="sparkles-outline" label="AI Assistant" tone="gold" onPress={openAi} />
      </View>

      {todayTasks.length > 0 ? (
        <View style={s.section}>
          <SectionHeader title="Today's tasks" action="View All" onAction={openTodo} />
          {todayTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => toggle(task.id)}
              onPress={() => openTask(task)}
            />
          ))}
        </View>
      ) : null}

      {upcoming.length > 0 ? (
        <View style={s.section}>
          <SectionHeader title="Upcoming deadlines" action="View All" onAction={openTodo} />
          {upcoming.map((task) => (
            <ListRow
              key={task.id}
              icon={task.kind === "quiz" ? "help-circle-outline" : "document-text-outline"}
              title={task.title}
              subtitle={`${task.classCode} · ${dueLabel(task.dueAt)}`}
              onPress={openTodo}
            />
          ))}
        </View>
      ) : null}

      {continueLearning.length > 0 ? (
        <View style={s.section}>
          <SectionHeader title="Continue Learning" action="View All" onAction={openCourses} />
          {continueLearning.map((c) => (
            <ClassCard key={c.id} item={c} onPress={() => openClass(c.id)} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  greetRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: SPACE.md },
  greet: { flex: 1 },
  actions: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", rowGap: SPACE.sm + 2 },
  section: { gap: SPACE.md },
});
