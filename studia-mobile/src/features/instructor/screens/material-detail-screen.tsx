// material-detail-screen.tsx — transcript + AI key objectives; polls while AI is processing.
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton, AiTag, Badge, Card, ConfirmDialog, IconTile, ListState, PageTitle } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C, OVERLAY } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteIds } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { AttachmentRow } from "@/shared/components/ui/attachment-row";
import { useDeleteMaterial, useMaterial } from "@/features/instructor/hooks/use-materials";

function secToLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MaterialDetailScreen() {
  const { classId, id } = useRouteIds("classId", "id");
  const router = useRouter();
  const goBack = useSafeBack(classId ? { pathname: "/instructor/class-detail", params: { id: classId } } : "/instructor/classes");
  const { data: material, loading, error, refetch } = useMaterial(classId, id);
  const deleteMaterial = useDeleteMaterial(classId ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // AI transcript/objectives land a few seconds after upload — poll while still processing.
  useEffect(() => {
    if (material?.processing !== "processing") return;
    const timer = setInterval(refetch, 2000);
    return () => clearInterval(timer);
  }, [material?.processing, refetch]);

  const remove = async () => {
    if (!id) return;
    const result = await deleteMaterial.run(id);
    setConfirmDelete(false);
    if (result.ok && classId) router.replace({ pathname: "/instructor/class-detail", params: { id: classId } });
  };

  return (
    <Screen role="instructor" scope="instructor/material-detail">
      <PageTitle title={material?.title ?? "Material"} onBack={goBack} />
      <ListState
        loading={loading}
        error={error}
        empty={!loading && !material}
        onRetry={refetch}
        emptyIcon="document-text-outline"
        emptyTitle="Material not found"
      >
        {material ? (
          <View style={{ gap: SPACE.lg }}>
            <View style={s.placeholder}>
              <IconTile
                name={material.kind === "video" ? "videocam-outline" : material.kind === "slide" ? "easel-outline" : "document-text-outline"}
                size={56}
                bg={OVERLAY.tile}
                color={C.white}
              />
              <Text style={s.placeholderText}>{material.attachment.name}</Text>
            </View>

            <AttachmentRow attachment={material.attachment} />

            {material.processing === "processing" ? (
              <Badge label="AI is extracting the transcript and key objectives..." tone="orange" />
            ) : material.processing === "failed" ? (
              <Badge label="AI processing failed" tone="red" />
            ) : (
              <Card>
                <AiTag text="AI-extracted key objectives" />
                <View style={{ gap: 4, marginTop: SPACE.sm }}>
                  {material.objectives.map((o, i) => (
                    <Text key={i} style={TYPE.muted}>
                      • {o}
                    </Text>
                  ))}
                </View>
              </Card>
            )}

            {material.transcript.length > 0 ? (
              <View style={{ gap: SPACE.md }}>
                <Text style={TYPE.h2}>Transcript</Text>
                {material.transcript.map((line) => (
                  <View key={line.id} style={s.transcriptLine}>
                    <Text style={TYPE.eyebrow}>{secToLabel(line.startSec)}</Text>
                    <Text style={TYPE.body}>{line.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <ActionButton label="Delete material" icon="trash-outline" variant="danger" onPress={() => setConfirmDelete(true)} />
          </View>
        ) : null}
      </ListState>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this material?"
        message="Students will no longer be able to open it."
        confirmLabel="Delete"
        busy={deleteMaterial.loading}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  placeholder: { height: 185, backgroundColor: C.primaryDark, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  placeholderText: { color: C.white, fontFamily: "Poppins_600SemiBold", fontSize: 13 },
  transcriptLine: { flexDirection: "row", gap: SPACE.sm + 2, paddingVertical: 6 },
});
