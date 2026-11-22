// home-screen.tsx — Instructor Home: greeting, overview numbers, what needs grading, shortcuts.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { EmptyState, ListRow, ListState, PageTitle, QuickAction, SectionHeader, StatCard } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { TONES } from "@/shared/constants/studia-colors";
import { SPACE } from "@/shared/constants/tokens";
import { plural, timeAgo } from "@/features/instructor/logic/format";
import { useInstructorClasses } from "@/features/instructor/hooks/use-classes";
import { useInstructorStats } from "@/features/instructor/hooks/use-stats";
import type { InstructorClass } from "@/features/instructor/types/instructor";

export default function InstructorHomeScreen() {
  const router = useSafeRouter();
  const classes = useInstructorClasses();
  const stats = useInstructorStats();

  const nextGrading = stats.data?.nextGrading ?? null;

  const openGrading = useCallback(
    () =>
      router.push(
        nextGrading
          ? { pathname: "/instructor/grading", params: { quizId: nextGrading.quizId } }
          : "/instructor/grading",
      ),
    [router, nextGrading],
  );

  const openClasses = useCallback(() => router.push("/instructor/classes"), [router]);
  const openGradebook = useCallback(() => router.push("/instructor/gradebook"), [router]);
  const openCreateQuiz = useCallback(() => router.push("/instructor/create-quiz"), [router]);
  const openAnalytics = useCallback(() => router.push("/instructor/analytics"), [router]);
  const openAiQuiz = useCallback(() => router.push("/instructor/ai-quiz"), [router]);
  const openClass = useCallback(
    (id: string) => router.push({ pathname: "/instructor/class-detail", params: { id } }),
    [router],
  );

  const topClasses = useMemo<InstructorClass[]>(
    () => (classes.data ?? []).slice(0, 2),
    [classes.data],
  );

  return (
    <Screen role="instructor" scope="instructor/home">
      <View style={s.page}>
        <PageTitle title="Home" />

        <ListState loading={stats.loading} error={null}>
          {stats.data ? (
            <View style={s.block}>
              <View style={s.statRow}>
                <StatCard label="Classes" value={stats.data.classCount} onPress={openClasses} />
                <StatCard label="Students" value={stats.data.studentCount} onPress={openClasses} />
                <StatCard
                  label="To Grade"
                  value={stats.data.pendingCount}
                  tone={stats.data.pendingCount > 0 ? "orange" : "green"}
                  onPress={openGrading}
                />
              </View>

              {nextGrading ? (
                <ListRow
                  icon="document-text-outline"
                  iconBg={TONES.orange.bg}
                  iconColor={TONES.orange.fg}
                  eyebrow="Needs grading"
                  title={`${plural(stats.data.pendingCount, "submission")} waiting`}
                  subtitle={`${nextGrading.quizTitle}, ${nextGrading.classCode} · Oldest ${timeAgo(nextGrading.oldestAt)}`}
                  onPress={openGrading}
                />
              ) : (
                <ListRow
                  icon="checkmark-circle-outline"
                  iconBg={TONES.green.bg}
                  iconColor={TONES.green.fg}
                  title="All caught up"
                  subtitle="No submissions waiting for review."
                  onPress={openGradebook}
                />
              )}
            </View>
          ) : null}
        </ListState>

        <View style={s.block}>
          <SectionHeader title="Quick actions" />
          <View style={s.actions}>
            <QuickAction icon="people-outline" label="My Classes" tone="primary" onPress={openClasses} />
            <QuickAction icon="create-outline" label="Create Quiz" tone="blue" onPress={openCreateQuiz} />
            <QuickAction icon="bar-chart-outline" label="Analytics" tone="green" onPress={openAnalytics} />
            <QuickAction icon="sparkles-outline" label="AI Quiz" tone="gold" onPress={openAiQuiz} />
          </View>
        </View>

        <View style={s.block}>
          <SectionHeader title="My Classes" action="View All" onAction={openClasses} />
          <ListState loading={classes.loading} error={classes.error} onRetry={classes.refetch}>
            {topClasses.length === 0 ? (
              <EmptyState icon="school-outline" title="No classes yet" message="Classes assigned to you will show up here." />
            ) : (
              <View style={s.block}>
                {topClasses.map((c) => (
                  <ListRow
                    key={c.id}
                    icon="book-outline"
                    eyebrow={`${c.code} · ${c.section}`}
                    title={c.title}
                    subtitle={plural(c.studentCount, "student")}
                    onPress={() => openClass(c.id)}
                  />
                ))}
              </View>
            )}
          </ListState>
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { gap: SPACE.xl },
  block: { gap: SPACE.md },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.md },
  actions: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", rowGap: SPACE.sm + 2 },
});
