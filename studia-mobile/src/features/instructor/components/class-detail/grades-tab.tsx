// grades-tab.tsx — Class detail "Grades" tab: quick summary, opens the full gradebook.
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { ActionButton, ListState, StatCard } from "@/shared/components/ui";
import { SPACE } from "@/shared/constants/tokens";
import { scoreTone, toPercent } from "@/features/instructor/logic/format";
import { useInstructorClass } from "@/features/instructor/hooks/use-classes";
import { useAllSubmissions } from "@/features/instructor/hooks/use-submissions";

export function GradesTab({ classId }: { classId: string }) {
  const router = useRouter();
  const cls = useInstructorClass(classId);
  const submissions = useAllSubmissions();
  const loading = cls.loading || submissions.loading;

  const scoped = useMemo(
    () => (submissions.data ?? []).filter((s) => s.classCode === cls.data?.code),
    [submissions.data, cls.data?.code],
  );
  const graded = scoped.filter((s) => s.score !== null);
  const pendingCount = scoped.length - graded.length;
  const average = graded.length
    ? Math.round(graded.reduce((sum, s) => sum + toPercent(s.score ?? 0, s.maxScore), 0) / graded.length)
    : null;

  return (
    <ListState loading={loading} error={submissions.error} onRetry={submissions.refetch}>
      <View style={{ gap: SPACE.lg }}>
        <View style={{ flexDirection: "row", gap: SPACE.md }}>
          <StatCard label="Average" value={average === null ? "–" : `${average}%`} tone={average === null ? "primary" : scoreTone(average)} />
          <StatCard label="Graded" value={graded.length} />
          <StatCard label="Pending" value={pendingCount} tone={pendingCount > 0 ? "orange" : "green"} />
        </View>
        <ActionButton
          label="Open gradebook"
          icon="bar-chart-outline"
          onPress={() => router.push({ pathname: "/instructor/gradebook", params: { classId } })}
        />
      </View>
    </ListState>
  );
}
