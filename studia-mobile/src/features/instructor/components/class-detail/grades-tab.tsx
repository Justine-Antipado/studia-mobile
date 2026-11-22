// grades-tab.tsx — Class detail "Grades" tab: quick summary for THIS class (by classId, so two
// sections sharing a subject code never mix), opens the full gradebook already scoped to it.
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { ActionButton, ListState, StatCard } from "@/shared/components/ui";
import { SPACE } from "@/shared/constants/tokens";
import { scoreTone } from "@/features/instructor/logic/format";
import { useGradebook } from "@/features/instructor/hooks/use-gradebook";
import { statsOf } from "@/features/instructor/logic/gradebook-summary";

export function GradesTab({ classId }: { classId: string }) {
  const router = useRouter();
  const book = useGradebook(classId);
  const stats = useMemo(() => statsOf(book.data ?? []), [book.data]);
  const average = stats.averagePercent;

  return (
    <ListState loading={book.loading} error={book.error} onRetry={book.refetch}>
      <View style={{ gap: SPACE.lg }}>
        <View style={{ flexDirection: "row", gap: SPACE.md }}>
          <StatCard label="Average" value={average === null ? "–" : `${average}%`} tone={average === null ? "primary" : scoreTone(average)} />
          <StatCard label="Graded" value={stats.graded} />
          <StatCard label="Pending" value={stats.pending} tone={stats.pending > 0 ? "orange" : "green"} />
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
