// gradebook-screen.tsx — grades for assignments AND quizzes. Scoped to one class (class chips are
// hidden when opened from a class) and filterable to "All" or one specific assignment/quiz.
//   All              -> one row per student, overall % weighted by points
//   a specific item  -> one row per student for that item (graded / pending / missing)
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  AppList,
  Badge,
  BottomSheet,
  Chip,
  ListRow,
  ListState,
  PageTitle,
  StatCard,
} from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { scoreTone, toPercent } from "@/features/instructor/logic/format";
import { useInstructorClasses } from "@/features/instructor/hooks/use-classes";
import { useGradebook } from "@/features/instructor/hooks/use-gradebook";
import {
  applyItem,
  itemKey,
  itemsOf,
  overallByStudent,
  statsOf,
  type ItemFilter,
  type StudentOverall,
} from "@/features/instructor/logic/gradebook-summary";
import type { GradeEntry } from "@/features/instructor/data/gradebook-repository";

type Row = { kind: "overall"; data: StudentOverall; id: string } | { kind: "entry"; data: GradeEntry; id: string };

export default function GradebookScreen() {
  const router = useRouter();
  const goBack = useSafeBack("/instructor/assessments");
  const presetClassId = useRouteId("classId");
  const classes = useInstructorClasses();
  const [pickedClass, setPickedClass] = useState<string | null>(null);
  const classId = presetClassId ?? pickedClass;
  const [item, setItem] = useState<ItemFilter>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const book = useGradebook(classId);
  const entries = useMemo(() => book.data ?? [], [book.data]);
  const items = useMemo(() => itemsOf(entries), [entries]);
  const scoped = useMemo(() => applyItem(entries, item), [entries, item]);
  const stats = useMemo(() => statsOf(scoped), [scoped]);
  const selectedItem = item ? items.find((i) => i.key === itemKey(item)) : undefined;

  const rows = useMemo<Row[]>(
    () =>
      item
        ? scoped
            .slice()
            .sort((a, b) => a.studentName.localeCompare(b.studentName))
            .map((e) => ({ kind: "entry", data: e, id: e.id }))
        : overallByStudent(scoped).map((o) => ({ kind: "overall", data: o, id: o.studentId })),
    [item, scoped],
  );

  const pickClass = useCallback((id: string | null) => {
    setPickedClass(id);
    setItem(null); // an item from another class would no longer exist
  }, []);

  const openEntry = useCallback(
    (e: GradeEntry) => {
      if (e.status === "missing") return;
      if (e.kind === "quiz" && e.attemptId) {
        router.push({ pathname: "/instructor/grade-submission", params: { id: e.attemptId } });
      } else if (e.kind === "assignment") {
        router.push({
          pathname: "/instructor/grade-assignment",
          params: { classId: e.classId, assignmentId: e.refId, studentId: e.studentId },
        });
      }
    },
    [router],
  );

  const renderRow = useCallback(
    (r: Row) => {
      if (r.kind === "overall") {
        const o = r.data;
        return (
          <ListRow
            icon="person-circle-outline"
            title={o.studentName}
            subtitle={`${o.graded} of ${o.total} graded`}
            trailing={
              o.percent === null ? <Badge label="–" tone="primary" /> : <Badge label={`${o.percent}%`} tone={scoreTone(o.percent)} />
            }
          />
        );
      }
      const e = r.data;
      const badge =
        e.status === "graded" ? (
          <Badge label={`${e.score}/${e.max} · ${toPercent(e.score ?? 0, e.max)}%`} tone={scoreTone(toPercent(e.score ?? 0, e.max))} />
        ) : e.status === "pending" ? (
          <Badge label="Needs grading" tone="orange" />
        ) : (
          <Badge label="Missing" tone="red" />
        );
      return (
        <ListRow
          icon="person-circle-outline"
          title={e.studentName}
          subtitle={e.kind === "quiz" ? "Quiz" : "Assignment"}
          trailing={badge}
          onPress={e.status === "missing" ? undefined : () => openEntry(e)}
        />
      );
    },
    [openEntry],
  );

  const openGrading = useCallback(() => router.push("/instructor/grading"), [router]);
  const showClassChips = !presetClassId;

  return (
    <Screen role="instructor" scroll={false} scope="instructor/gradebook">
      <PageTitle
        title="Gradebook"
        subtitle={item ? (selectedItem?.title ?? "Selected item") : "Overall, weighted by points."}
        onBack={goBack}
      />

      {showClassChips ? (
        <View style={s.chipRow}>
          <Chip label="All classes" selected={classId === null} onPress={() => pickClass(null)} />
          {(classes.data ?? []).map((c) => (
            <Chip key={c.id} label={`${c.code} · ${c.section}`} selected={classId === c.id} onPress={() => pickClass(c.id)} />
          ))}
        </View>
      ) : null}

      <View style={s.chipRow}>
        <Chip
          label={item ? `Show: ${selectedItem?.title ?? "1 item"}` : "Show: All"}
          icon="funnel-outline"
          selected={!!item}
          onPress={() => setPickerOpen(true)}
        />
        {item ? <Chip label="Clear" onPress={() => setItem(null)} /> : null}
      </View>

      <View style={s.statRow}>
        <StatCard
          label="Average"
          value={stats.averagePercent === null ? "–" : `${stats.averagePercent}%`}
          tone={stats.averagePercent === null ? "primary" : scoreTone(stats.averagePercent)}
        />
        {item ? (
          <>
            <StatCard label="High" value={stats.high === null ? "–" : `${stats.high}%`} />
            <StatCard label="Low" value={stats.low === null ? "–" : `${stats.low}%`} />
          </>
        ) : (
          <StatCard label="Graded" value={stats.graded} />
        )}
        <StatCard label="Pending" value={stats.pending} tone={stats.pending > 0 ? "orange" : "green"} onPress={openGrading} />
        {item ? <StatCard label="Missing" value={stats.missing} tone={stats.missing > 0 ? "red" : "green"} /> : null}
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

      <BottomSheet visible={pickerOpen} title="Show grades for" onClose={() => setPickerOpen(false)}>
        <ListRow
          icon="layers-outline"
          title="All assignments and quizzes"
          trailing={!item ? <Badge label="Selected" tone="primary" /> : undefined}
          onPress={() => {
            setItem(null);
            setPickerOpen(false);
          }}
        />
        {items.length === 0 ? <Text style={TYPE.muted}>Nothing to filter by yet.</Text> : null}
        {items.map((i) => (
          <ListRow
            key={i.key}
            icon={i.kind === "quiz" ? "document-text-outline" : "clipboard-outline"}
            eyebrow={`${i.classCode} · ${i.kind === "quiz" ? "Quiz" : "Assignment"}`}
            title={i.title}
            trailing={item && itemKey(item) === i.key ? <Badge label="Selected" tone="primary" /> : undefined}
            onPress={() => {
              setItem({ kind: i.kind, refId: i.refId });
              setPickerOpen(false);
            }}
          />
        ))}
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.md },
  fill: { flex: 1 },
});
