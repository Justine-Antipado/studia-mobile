// grading-screen.tsx — submissions waiting for review, oldest first, optionally filtered by quiz.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppList, FilterPillSheet, ListRow, ListState, PageTitle, type FilterGroup } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { plural, timeAgo } from "@/features/instructor/logic/format";
import { useAllSubmissions } from "@/features/instructor/hooks/use-submissions";
import type { Submission } from "@/features/instructor/types/instructor";

const ALL_QUIZZES = "all";
const DEFAULT_FILTERS = { quiz: ALL_QUIZZES };

export default function GradingScreen() {
  const router = useSafeRouter();
  const goBack = useSafeBack("/instructor/assessments");
  const presetQuizId = useRouteId("quizId");
  const { data, loading, error, refetch } = useAllSubmissions();
  const [filter, setFilter] = useState<string | null>(presetQuizId);

  const pending = useMemo(
    () => (data ?? []).filter((x) => x.score === null).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)),
    [data],
  );

  const quizzes = useMemo(() => {
    const map = new Map<string, string>();
    pending.forEach((x) => map.set(x.quizId, `${x.classCode} · ${x.quizTitle}`));
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [pending]);

  // If the filtered quiz has nothing left to grade, fall back to "All".
  const active = quizzes.some((q) => q.id === filter) ? filter : null;
  const visible = useMemo(
    () => (active ? pending.filter((x) => x.quizId === active) : pending),
    [pending, active],
  );

  const filterGroups = useMemo<FilterGroup[]>(
    () => [
      {
        key: "quiz",
        title: "Quiz",
        options: [{ value: ALL_QUIZZES, label: "All quizzes" }, ...quizzes.map((q) => ({ value: q.id, label: q.label }))],
      },
    ],
    [quizzes],
  );

  const openSubmission = useCallback(
    (id: string) => router.push({ pathname: "/instructor/grade-submission", params: { id } }),
    [router],
  );

  const renderRow = useCallback(
    (x: Submission) => (
      <ListRow
        icon="document-text-outline"
        eyebrow={`${x.classCode} · ${x.quizTitle}`}
        title={x.studentName}
        subtitle={`Submitted ${timeAgo(x.submittedAt)}`}
        onPress={() => openSubmission(x.id)}
      />
    ),
    [openSubmission],
  );

  return (
    <Screen role="instructor" scroll={false} scope="instructor/grading">
      <PageTitle title="Needs Grading" subtitle={`${plural(pending.length, "submission")} waiting, oldest first`} onBack={goBack} />

      {quizzes.length > 1 ? (
        <FilterPillSheet
          groups={filterGroups}
          value={{ quiz: active ?? ALL_QUIZZES }}
          defaults={DEFAULT_FILTERS}
          onApply={(next) => setFilter(next.quiz === ALL_QUIZZES ? null : next.quiz)}
        />
      ) : null}

      <View style={s.fill}>
        <ListState loading={loading} error={error} onRetry={refetch} empty={!loading && pending.length === 0} emptyIcon="checkmark-done-outline" emptyTitle="All caught up" emptyMessage="Every submission has been graded.">
          <AppList data={visible} renderRow={renderRow} refreshing={loading} onRefresh={refetch} />
        </ListState>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
});
