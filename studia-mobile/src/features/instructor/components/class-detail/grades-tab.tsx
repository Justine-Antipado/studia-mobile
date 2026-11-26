// grades-tab.tsx — Class detail "Grades" tab: every enrolled student's overall grade for THIS
// class (by classId, so two sections sharing a subject code never mix), listed alphabetically by
// name (overallByStudent already sorts that way).
import { useMemo } from "react";
import { View } from "react-native";

import { Badge, ListRow, ListState, StatCard } from "@/shared/components/ui";
import { SPACE } from "@/shared/constants/tokens";
import { scoreTone } from "@/features/instructor/logic/format";
import { useGradebook } from "@/features/instructor/hooks/use-gradebook";
import { overallByStudent, statsOf } from "@/features/instructor/logic/gradebook-summary";

export function GradesTab({ classId }: { classId: string }) {
  const book = useGradebook(classId);
  const entries = useMemo(() => book.data ?? [], [book.data]);
  const stats = useMemo(() => statsOf(entries), [entries]);
  const students = useMemo(() => overallByStudent(entries), [entries]);

  return (
    <ListState
      loading={book.loading}
      error={book.error}
      empty={!book.loading && students.length === 0}
      onRetry={book.refetch}
      emptyIcon="bar-chart-outline"
      emptyTitle="No grades yet"
      emptyMessage="Create an assignment or quiz and grade submissions to see student grades here."
    >
      <View style={{ gap: SPACE.lg }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.md }}>
          <StatCard
            label="Average"
            value={stats.averagePercent === null ? "–" : `${stats.averagePercent}%`}
            tone={stats.averagePercent === null ? "primary" : scoreTone(stats.averagePercent)}
          />
          <StatCard label="Graded" value={stats.graded} />
          <StatCard label="Pending" value={stats.pending} tone={stats.pending > 0 ? "orange" : "green"} />
        </View>

        <View style={{ gap: SPACE.md }}>
          {students.map((o) => (
            <ListRow
              key={o.studentId}
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
          ))}
        </View>
      </View>
    </ListState>
  );
}
