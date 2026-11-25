// gradebook-screen.tsx — grades for assignments AND quizzes: one row per student, overall
// percentage weighted by points (a 50-point exam counts more than a 5-point quiz).
//
// F1: the class comes from the Filters sheet (chips did not scale past a handful of classes) and the
// per-item "Show: All / one assignment" filter is gone — the Assessments tab and the grading queue
// already cover that. Opened from a class (classId param) there is no picker at all: the class is
// the scope, so there is nothing left to filter.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppList,
  Badge,
  ListRow,
  ListState,
  PageTitle,
  FilterPillSheet,
  StatCard,
  type FilterGroup,
} from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE } from "@/shared/constants/tokens";
import { useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { scoreTone } from "@/features/instructor/logic/format";
import { useInstructorClasses } from "@/features/instructor/hooks/use-classes";
import { useGradebook } from "@/features/instructor/hooks/use-gradebook";
import { overallByStudent, statsOf, type StudentOverall } from "@/features/instructor/logic/gradebook-summary";

/** "All classes" is an option of the dropdown, not a filter control of its own. */
const ALL_CLASSES = "all";

const DEFAULT_FILTERS = { class: ALL_CLASSES };

type Row = StudentOverall & { id: string };

export default function GradebookScreen() {
  const router = useSafeRouter();
  const goBack = useSafeBack("/instructor/assessments");
  const presetClassId = useRouteId("classId");
  const classes = useInstructorClasses();
  const [picked, setPicked] = useState<string>(ALL_CLASSES);
  const classId = presetClassId ?? (picked === ALL_CLASSES ? null : picked);

  const book = useGradebook(classId);
  const entries = useMemo(() => book.data ?? [], [book.data]);
  const stats = useMemo(() => statsOf(entries), [entries]);
  const rows = useMemo<Row[]>(
    () => overallByStudent(entries).map((o) => ({ ...o, id: o.studentId })),
    [entries],
  );

  const filterGroups = useMemo<FilterGroup[]>(
    () => [
      {
        key: "class",
        title: "Class",
        options: [
          { value: ALL_CLASSES, label: "All classes" },
          ...(classes.data ?? []).map((c) => ({ value: c.id, label: `${c.code} · ${c.section}` })),
        ],
      },
    ],
    [classes.data],
  );

  const renderRow = useCallback(
    (o: Row) => (
      <ListRow
        icon="person-circle-outline"
        title={o.studentName}
        subtitle={`${o.graded} of ${o.total} graded`}
        trailing={
          o.percent === null ? (
            <Badge label="–" tone="primary" />
          ) : (
            <Badge label={`${o.percent}%`} tone={scoreTone(o.percent)} />
          )
        }
      />
    ),
    [],
  );

  const openGrading = useCallback(() => router.push("/instructor/grading"), [router]);

  return (
    <Screen role="instructor" scroll={false} scope="instructor/gradebook">
      <PageTitle title="Gradebook" subtitle="Overall, weighted by points." onBack={goBack} />

      {presetClassId ? null : (
        <FilterPillSheet
          groups={filterGroups}
          value={{ class: picked }}
          defaults={DEFAULT_FILTERS}
          onApply={(next) => setPicked(next.class)}
        />
      )}

      <View style={s.statRow}>
        <StatCard
          label="Average"
          value={stats.averagePercent === null ? "–" : `${stats.averagePercent}%`}
          tone={stats.averagePercent === null ? "primary" : scoreTone(stats.averagePercent)}
        />
        <StatCard label="Graded" value={stats.graded} />
        <StatCard
          label="Pending"
          value={stats.pending}
          tone={stats.pending > 0 ? "orange" : "green"}
          onPress={openGrading}
        />
      </View>

      <View style={s.fill}>
        <ListState
          loading={book.loading}
          error={book.error}
          onRetry={book.refetch}
          empty={!book.loading && rows.length === 0}
          emptyIcon="bar-chart-outline"
          emptyTitle="No grades yet"
          emptyMessage="Create an assignment or quiz and grade submissions to see them here."
        >
          <AppList data={rows} renderRow={renderRow} refreshing={book.loading} onRefresh={book.refetch} />
        </ListState>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.md },
  fill: { flex: 1 },
});
