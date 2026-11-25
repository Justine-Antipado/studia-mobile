// assignment-submissions.tsx — "Submissions" section of the instructor assignment detail:
// summary counts, status filter chips, and one row per student (turned in / late / missing /
// graded with score). Tapping a student opens the grading screen.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Badge, FilterPillSheet, ListRow, ListState, SectionHeader, type FilterGroup } from "@/shared/components/ui";
import type { Tone } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { timeAgo } from "@/features/instructor/logic/format";
import { useAssignmentSubmissions } from "@/features/instructor/hooks/use-assignment-submissions";
import type {
  AssignmentSubmission,
  AssignmentSubmissionStatus,
} from "@/features/instructor/data/assignment-submissions-repository";

const FILTERS = ["All", "Submitted", "Late", "Missing", "Graded"] as const;
type Filter = (typeof FILTERS)[number];
const DEFAULT_FILTERS = { status: "All" };

const STATUS: Record<AssignmentSubmissionStatus, { label: string; tone: Tone }> = {
  missing: { label: "Missing", tone: "red" },
  draft: { label: "Draft (not turned in)", tone: "orange" },
  submitted: { label: "Submitted", tone: "blue" },
  late: { label: "Late", tone: "orange" },
  graded: { label: "Graded", tone: "green" },
};

const matches = (s: AssignmentSubmission, f: Filter) =>
  f === "All" ||
  (f === "Submitted" && s.status === "submitted") ||
  (f === "Late" && s.status === "late") ||
  (f === "Missing" && (s.status === "missing" || s.status === "draft")) ||
  (f === "Graded" && s.status === "graded");

export function AssignmentSubmissions({
  classId,
  assignmentId,
  points,
}: {
  classId: string;
  assignmentId: string;
  points: number;
}) {
  const router = useSafeRouter();
  const { data, loading, error, refetch } = useAssignmentSubmissions(classId, assignmentId);
  const [filter, setFilter] = useState<Filter>("All");
  const rows = useMemo(() => data ?? [], [data]);
  const shown = useMemo(() => rows.filter((r) => matches(r, filter)), [rows, filter]);

  const count = useCallback((f: Filter) => rows.filter((r) => matches(r, f)).length, [rows]);
  const filterGroups = useMemo<FilterGroup[]>(
    () => [
      {
        key: "status",
        title: "Status",
        options: FILTERS.map((f) => ({ value: f, label: f, meta: String(count(f)) })),
      },
    ],
    [count],
  );

  const open = (s: AssignmentSubmission) =>
    router.push({
      pathname: "/instructor/grade-assignment",
      params: { classId, assignmentId, studentId: s.studentId },
    });

  return (
    <View style={s.wrap}>
      <SectionHeader title={`Submissions (${rows.length} students)`} />
      <Text style={TYPE.muted}>
        {`Submitted ${count("Submitted")} · Late ${count("Late")} · Missing ${count("Missing")} · Graded ${count("Graded")}`}
      </Text>
      <FilterPillSheet
        groups={filterGroups}
        value={{ status: filter }}
        defaults={DEFAULT_FILTERS}
        onApply={(next) => setFilter(next.status as Filter)}
      />

      <ListState
        loading={loading}
        error={error}
        empty={!loading && shown.length === 0}
        onRetry={refetch}
        emptyIcon="people-outline"
        emptyTitle="No students here"
        emptyMessage="Nobody matches this filter."
      >
        <View style={s.list}>
          {shown.map((r) => {
            const st = STATUS[r.status];
            const canGrade = r.status !== "missing" && r.status !== "draft";
            return (
              <ListRow
                key={r.studentId}
                icon="person-outline"
                title={r.studentName}
                subtitle={r.submittedAt ? `Turned in ${timeAgo(r.submittedAt)}` : st.label}
                trailing={
                  r.status === "graded" ? (
                    <Badge label={`${r.score}/${points}`} tone="green" />
                  ) : (
                    <Badge label={st.label} tone={st.tone} />
                  )
                }
                onPress={canGrade ? () => open(r) : undefined}
              />
            );
          })}
        </View>
      </ListState>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  list: { gap: SPACE.sm },
});
