// gradebook-screen.tsx — graded quizzes, newest first; optionally scoped to one class.
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppList, Badge, Chip, ListRow, ListState, PageTitle, StatCard } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE } from "@/shared/constants/tokens";
import { useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { scoreTone, timeAgo, toPercent } from "@/features/instructor/logic/format";
import { useInstructorClasses } from "@/features/instructor/hooks/use-classes";
import { useAllSubmissions } from "@/features/instructor/hooks/use-submissions";
import type { Submission } from "@/features/instructor/types/instructor";

export default function GradebookScreen() {
  const router = useRouter();
  const goBack = useSafeBack("/instructor/assessments");
  const presetClassId = useRouteId("classId");
  const classes = useInstructorClasses();
  const submissions = useAllSubmissions();
  const presetCode = (classes.data ?? []).find((c) => c.id === presetClassId)?.code ?? null;
  const [code, setCode] = useState<string | null>(presetCode);

  const codes = useMemo(() => Array.from(new Set((classes.data ?? []).map((c) => c.code))), [classes.data]);

  const scoped = useMemo(
    () => (code ? (submissions.data ?? []).filter((x) => x.classCode === code) : submissions.data ?? []),
    [submissions.data, code],
  );
  const graded = useMemo(
    () => scoped.filter((x) => x.score !== null).sort((a, b) => (b.gradedAt ?? "").localeCompare(a.gradedAt ?? "")),
    [scoped],
  );
  const pendingCount = scoped.length - graded.length;
  const average = useMemo(
    () =>
      graded.length
        ? Math.round(graded.reduce((sum, x) => sum + toPercent(x.score ?? 0, x.maxScore), 0) / graded.length)
        : null,
    [graded],
  );

  const openSubmission = useCallback(
    (id: string) => router.push({ pathname: "/instructor/grade-submission", params: { id } }),
    [router],
  );

  const renderRow = useCallback(
    (x: Submission) => {
      const pct = toPercent(x.score ?? 0, x.maxScore);
      return (
        <ListRow
          icon="person-circle-outline"
          eyebrow={`${x.classCode} · ${x.quizTitle}`}
          title={x.studentName}
          subtitle={x.gradedAt ? `Graded ${timeAgo(x.gradedAt)}` : undefined}
          trailing={<Badge label={`${x.score}/${x.maxScore} · ${pct}%`} tone={scoreTone(pct)} />}
          onPress={() => openSubmission(x.id)}
        />
      );
    },
    [openSubmission],
  );

  const openGrading = useCallback(() => router.push("/instructor/grading"), [router]);

  return (
    <Screen role="instructor" scroll={false} scope="instructor/gradebook">
      <PageTitle title="Gradebook" subtitle="Graded quizzes, newest first." onBack={goBack} />

      <View style={s.chipRow}>
        <Chip label="All classes" selected={code === null} onPress={() => setCode(null)} />
        {codes.map((c) => <Chip key={c} label={c} selected={code === c} onPress={() => setCode(c)} />)}
      </View>

      <View style={s.statRow}>
        <StatCard label="Average" value={average === null ? "–" : `${average}%`} tone={average === null ? "primary" : scoreTone(average)} />
        <StatCard label="Graded" value={graded.length} />
        <StatCard label="Pending" value={pendingCount} tone={pendingCount > 0 ? "orange" : "green"} onPress={openGrading} />
      </View>

      <View style={s.fill}>
        <ListState
          loading={submissions.loading}
          error={submissions.error}
          onRetry={submissions.refetch}
          empty={!submissions.loading && graded.length === 0}
          emptyIcon="bar-chart-outline"
          emptyTitle="Nothing graded yet"
          emptyMessage="Graded quizzes will appear here."
        >
          <AppList
            data={graded}
            renderRow={renderRow}
            refreshing={submissions.loading}
            onRefresh={submissions.refetch}
          />
        </ListState>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.md },
  fill: { flex: 1 },
});
