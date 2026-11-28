// home-screen.tsx — greeting, quick actions, today's tasks, upcoming deadlines, continue learning.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { Badge, Card, EmptyState, ListRow, ListState, PageTitle, QuickAction, Reveal, SectionHeader, StatCard } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { TONES } from "@/shared/constants/studia-colors";
import { SPACE } from "@/shared/constants/tokens";
import { displayName, tagLabel, useRoleUser } from "@/core/data/storage/session-store";
import { ClassCard } from "@/features/student/components/class-card";
import { TaskRow } from "@/features/student/components/task-row";
import { dueLabel, greeting, isOverdue } from "@/features/student/logic/format";
import { useClasses } from "@/features/student/hooks/use-classes";
import { useTasks } from "@/features/student/hooks/use-tasks";
import type { Task } from "@/features/student/types/student";

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export default function StudentHome() {
  const router = useSafeRouter();
  const user = useRoleUser("student");
  const classes = useClasses();
  const tasks = useTasks();

  // Derived once per data change: Home re-renders on every cache notification, and these
  // feed memoized rows, so recomputing them would re-render every row for nothing.
  const { todayTasks, upcoming, todayCount, upcomingCount } = useMemo(() => {
    const pending = (tasks.data ?? []).filter((t) => !t.done);
    const today = pending.filter((t) => isToday(t.dueAt) || isOverdue(t.dueAt));
    const todayIds = new Set(today.map((t) => t.id));
    const rest = pending.filter((t) => !todayIds.has(t.id));
    return {
      todayTasks: today.slice(0, 3),
      upcoming: rest.slice(0, 3),
      todayCount: today.length,
      upcomingCount: rest.length,
    };
  }, [tasks.data]);

  const continueLearning = useMemo(
    () => {
      // In-progress classes first; a class with no progress yet still belongs here so the section is never empty.
      const open = (classes.data ?? []).filter((c) => c.progress < 1);
      return open.sort((a, b) => b.progress - a.progress).slice(0, 2);
    },
    [classes.data],
  );

  const go = useCallback((path: "courses" | "todo" | "planner" | "ai") =>
    router.push(`/student/${path}`), [router]);

  const openCourses = useCallback(() => go("courses"), [go]);
  const openTodo = useCallback(() => go("todo"), [go]);
  const openPlanner = useCallback(() => go("planner"), [go]);
  const openAi = useCallback(() => go("ai"), [go]);

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

  if (!user) return null;

  return (
    <Screen
      role="student"
      scope="student/home"
      refreshing={tasks.loading && !!tasks.data}
      onRefresh={tasks.refetch}
    >
      <View style={s.page}>
        <Reveal index={0}>
          <PageTitle
            title={displayName(user)}
            subtitle={greeting()}
            trailing={<Badge label={tagLabel(user)} />}
          />
        </Reveal>

        <Reveal index={1}>
          <View style={s.statRow}>
            <StatCard label="Courses" value={classes.data?.length ?? 0} onPress={openCourses} />
            <StatCard
              label="Due Today"
              value={todayCount}
              tone={todayCount > 0 ? "orange" : "green"}
              onPress={openTodo}
            />
            <StatCard label="Upcoming" value={upcomingCount} tone="blue" onPress={openTodo} />
          </View>
        </Reveal>

        <Reveal index={2}>
          <Card style={s.actionsCard}>
            <SectionHeader title="Quick actions" compact />
            <View style={s.actions}>
              <QuickAction icon="book-outline" label="My Courses" onPress={openCourses} />
              <QuickAction icon="checkbox-outline" label="To-do" tone="green" onPress={openTodo} />
              <QuickAction icon="calendar-outline" label="Planner" tone="blue" onPress={openPlanner} />
              <QuickAction icon="sparkles-outline" label="AI Assistant" tone="gold" onPress={openAi} />
            </View>
          </Card>
        </Reveal>

        <Reveal index={3}>
          <View style={s.block}>
            <SectionHeader title="Today's tasks" action="View All" onAction={openTodo} />
            <ListState loading={tasks.loading} error={tasks.error} onRetry={tasks.refetch}>
              {todayTasks.length === 0 ? (
                <ListRow
                  icon="checkmark-circle-outline"
                  iconBg={TONES.green.bg}
                  iconColor={TONES.green.fg}
                  title="All caught up"
                  subtitle="Nothing is due today."
                  onPress={openTodo}
                />
              ) : (
                todayTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onPress={() => openTask(task)} />
                ))
              )}
            </ListState>
          </View>
        </Reveal>

        <Reveal index={4}>
          <View style={s.block}>
            <SectionHeader title="Upcoming deadlines" action="View All" onAction={openTodo} />
            <ListState loading={tasks.loading} error={tasks.error} onRetry={tasks.refetch}>
              {upcoming.length === 0 ? (
                <EmptyState icon="calendar-outline" title="No upcoming deadlines" message="Assignments and quizzes with due dates will show up here." />
              ) : (
                upcoming.map((task) => (
                  <ListRow
                    key={task.id}
                    icon={task.kind === "quiz" ? "help-circle-outline" : "document-text-outline"}
                    title={task.title}
                    subtitle={`${task.classCode} · ${dueLabel(task.dueAt)}`}
                    onPress={openTodo}
                  />
                ))
              )}
            </ListState>
          </View>
        </Reveal>

        <Reveal index={5}>
          <View style={s.block}>
            <SectionHeader title="Continue Learning" action="View All" onAction={openCourses} />
            <ListState loading={classes.loading} error={classes.error} onRetry={classes.refetch}>
              {continueLearning.length === 0 ? (
                <EmptyState icon="school-outline" title="No courses yet" message="Join a class with a code from your instructor to start learning." />
              ) : (
                continueLearning.map((c) => <ClassCard key={c.id} item={c} onPress={() => openClass(c.id)} />)
              )}
            </ListState>
          </View>
        </Reveal>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  actions: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", rowGap: SPACE.sm + 2 },
  actionsCard: { gap: SPACE.md },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.md },
  page: { gap: SPACE.xl },
  block: { gap: SPACE.md },
});
