import { useRouter, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Chip, EmptyState, ListCard, Page, PageTitle } from "@/features/instructor/components/instructor-ui";
import { useSubmissions } from "@/features/instructor/data/instructor-store";
import { firstParam, plural, timeAgo } from "@/features/instructor/logic/format";
import { Screen } from "@/shared/components/ui/screen";
import { useSafeBack } from "@/shared/hooks/use-safe-back";

export default function GradingScreen() {
  const router = useRouter();
  const goBack = useSafeBack();
  const params = useLocalSearchParams<{ quizId?: string | string[] }>();
  const [filter, setFilter] = useState<string | null>(firstParam(params.quizId) ?? null);
  const submissions = useSubmissions();

  const pending = useMemo(
    () => submissions.filter((x) => x.score === null).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)),
    [submissions],
  );

  const quizzes = useMemo(() => {
    const map = new Map<string, string>();
    pending.forEach((x) => map.set(x.quizId, `${x.classCode} · ${x.quizTitle}`));
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [pending]);

  // If the filtered quiz has nothing left to grade, fall back to "All".
  const active = quizzes.some((q) => q.id === filter) ? filter : null;
  const visible = active ? pending.filter((x) => x.quizId === active) : pending;

  return (
    <Screen role="instructor">
      <Page>
        <PageTitle title="Needs Grading" subtitle={`${plural(pending.length, "submission")} waiting, oldest first`} onBack={goBack} />

        {quizzes.length > 1 && (
          <View style={s.chips}>
            <Chip label="All" selected={active === null} onPress={() => setFilter(null)} />
            {quizzes.map((q) => <Chip key={q.id} label={q.label} selected={active === q.id} onPress={() => setFilter(q.id)} />)}
          </View>
        )}

        {visible.length === 0 ? (
          <EmptyState icon="checkmark-done-outline" title="All caught up" message="Every submission has been graded." />
        ) : (
          visible.map((x) => (
            <ListCard
              key={x.id}
              icon="document-text-outline"
              tone="orange"
              eyebrow={`${x.classCode} · ${x.quizTitle}`}
              title={x.studentName}
              meta={`Submitted ${timeAgo(x.submittedAt)}`}
              onPress={() => router.push({ pathname: "/instructor/grade-submission", params: { id: x.id } })}
            />
          ))
        )}
      </Page>
    </Screen>
  );
}

const s = StyleSheet.create({ chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } });
