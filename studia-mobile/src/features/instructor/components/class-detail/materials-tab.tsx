// materials-tab.tsx — Class detail "Materials" tab: lessons/files with AI processing status.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { View } from "react-native";

import { ActionButton, Badge, ListRow, ListState, SectionHeader } from "@/shared/components/ui";
import type { IconName } from "@/shared/components/ui/icon";
import type { Tone } from "@/shared/constants/studia-colors";
import { SPACE } from "@/shared/constants/tokens";
import { materialDetail, timeAgo } from "@/features/instructor/logic/format";
import { useClassMaterials } from "@/features/instructor/hooks/use-materials";
import type { Material, ProcessingState } from "@/features/instructor/types/instructor";

const ICON_BY_KIND: Record<Material["kind"], IconName> = {
  video: "videocam-outline",
  pdf: "document-text-outline",
  slide: "easel-outline",
};
const PROCESSING_TONE: Record<ProcessingState, Tone> = { processing: "orange", ready: "green", failed: "red" };
const PROCESSING_LABEL: Record<ProcessingState, string> = { processing: "Processing", ready: "Ready", failed: "Failed" };

export function MaterialsTab({ classId }: { classId: string }) {
  const router = useSafeRouter();
  const { data, loading, error, refetch } = useClassMaterials(classId);
  const materials = data ?? [];

  return (
    <View style={{ gap: SPACE.md + 2 }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          rowGap: SPACE.sm,
          columnGap: SPACE.sm,
        }}
      >
        <SectionHeader title="Materials" />
        <ActionButton
          label="Add"
          icon="add"
          variant="secondary"
          onPress={() => router.push({ pathname: "/instructor/upload-material", params: { classId } })}
        />
      </View>
      <ListState
        loading={loading}
        error={error}
        empty={!loading && materials.length === 0}
        onRetry={refetch}
        emptyIcon="folder-open-outline"
        emptyTitle="No materials yet"
        emptyMessage="Add a video link, slides or a PDF to get started."
      >
        <View style={{ gap: SPACE.md }}>
          {materials.map((m) => (
            <ListRow
              key={m.id}
              icon={ICON_BY_KIND[m.kind]}
              title={m.title}
              subtitle={`${materialDetail(m)} · ${timeAgo(m.postedAt)}`}
              trailing={<Badge label={PROCESSING_LABEL[m.processing]} tone={PROCESSING_TONE[m.processing]} />}
              onPress={() => router.push({ pathname: "/instructor/material-detail", params: { classId, id: m.id } })}
            />
          ))}
        </View>
      </ListState>
    </View>
  );
}
