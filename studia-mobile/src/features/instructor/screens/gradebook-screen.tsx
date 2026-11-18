import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Chip, EmptyState, ListCard, Page, PageTitle, Pill, StatCard } from "@/features/instructor/components/instructor-ui";
import { useInstructorClasses, useSubmissions } from "@/features/instructor/data/instructor-store";
import { scoreTone, timeAgo, toPercent } from "@/features/instructor/logic/format";
import { Screen } from "@/shared/components/ui/screen";
import { useSafeBack } from "@/shared/hooks/use-safe-back";

export default function GradebookScreen() {
  const router = useRouter();
  const goBack = useSafeBack();
  const classes = useInstructorClasses();
  const submissions = useSubmissions();
  const [code, setCode] = useState<string | null>(null);

  const codes = useMemo(() => Array.from(new Set(classes.map((c) => c.code))), [classes]);

  const scoped = useMemo(() => (code ? submissions.filter((x) => x.classCode === code) : submissions), [submissions, code]);
  const graded = useMemo(
    () => scoped.filter((x) => x.score !== null).sort((a, b) => (b.gradedAt ?? "").localeCompare(a.gradedAt ?? "")),
    [scoped],
  );
  const pendingCount = scoped.length - graded.length;
  const average = graded.length
    ? Math.round(graded.reduce((sum, x) => sum + toPercent(x.score ?? 0, x.maxScore), 0) / graded.length)
    : null;

  return (
    <Screen role="instructor">
      <Page>
        <PageTitle title="Gradebook" subtitle="Graded quizzes, newest first." onBack={goBack} />

        <View style={s.chips}>
          <Chip label="All classes" selected={code === null} onPress={() => setCode(null)} />
          {codes.map((c) => <Chip key={c} label={c} selected={code === c} onPress={() => setCode(c)} />)}
        </View>

        <View style={s.stats}>
          <StatCard label="Average" value={average === null ? "–" : `${average}%`} tone={average === null ? "primary" : scoreTone(average)} />
          <StatCard label="Graded" value={graded.length} />
          <StatCard label="Pending" value={pendingCount} tone={pendingCount > 0 ? "orange" : "green"} onPress={() => router.push("/instructor/grading")} />
        </View>

        {graded.length === 0 ? (
          <EmptyState icon="bar-chart-outline" title="Nothing graded yet" message="Graded quizzes will appear here." />
        ) : (
          graded.map((x) => {
            const pct = toPercent(x.score ?? 0, x.maxScore);
            return (
              <ListCard
                key={x.id}
                icon="person-circle-outline"
                eyebrow={`${x.classCode} · ${x.quizTitle}`}
                title={x.studentName}
                meta={x.gradedAt ? `Graded ${timeAgo(x.gradedAt)}` : undefined}
                trailing={<Pill label={`${x.score}/${x.maxScore} · ${pct}%`} tone={scoreTone(pct)} />}
                onPress={() => router.push({ pathname: "/instructor/grade-submission", params: { id: x.id } })}
              />
            );
          })
        )}
      </Page>
    </Screen>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stats: { flexDirection: "row", gap: 10 },
});
