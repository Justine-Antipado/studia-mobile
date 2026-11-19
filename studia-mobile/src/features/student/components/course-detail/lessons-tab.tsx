// lessons-tab.tsx — Course detail "Lessons" tab: materials with AI processing/ready states.
import { useRouter } from "expo-router";
import { View } from "react-native";

import { Badge, ListRow, ListState } from "@/shared/components/ui";
import { SPACE } from "@/shared/constants/tokens";
import { useLessons } from "@/features/student/hooks/use-lessons";

export function LessonsTab({ classId }: { classId: string }) {
  const router = useRouter();
  const { data, loading, error, refetch } = useLessons(classId);
  const lessons = data ?? [];

  return (
    <ListState
      loading={loading}
      error={error}
      empty={!loading && lessons.length === 0}
      onRetry={refetch}
      emptyIcon="play-circle-outline"
      emptyTitle="No lessons yet"
      emptyMessage="Lessons and materials will show up here once posted."
    >
      <View style={{ gap: SPACE.md }}>
        {lessons.map((l) => (
          <ListRow
            key={l.id}
            icon={l.kind === "video" ? "play-circle-outline" : l.kind === "slide" ? "easel-outline" : "document-text-outline"}
            title={l.title}
            subtitle={l.durationLabel ?? l.attachment.name}
            onPress={() => router.push({ pathname: "/student/lesson-viewer", params: { classId, id: l.id } })}
            trailing={
              l.processing === "processing" ? (
                <Badge label="Processing" tone="gold" />
              ) : l.processing === "failed" ? (
                <Badge label="Failed" tone="red" />
              ) : undefined
            }
          />
        ))}
      </View>
    </ListState>
  );
}
