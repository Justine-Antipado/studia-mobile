// material-detail-screen.tsx — transcript + AI key objectives; polls while AI is processing.
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton, AiTag, Badge, Card, ConfirmDialog, FormField, IconTile, ListState, PageTitle, VideoLinkCard, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C, OVERLAY } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteIds } from "@/core/logic/route-params";
import { useOpenFile } from "@/features/shared-screens/hooks/use-open-file";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { AttachmentRow } from "@/shared/components/ui/attachment-row";
import { useDeleteMaterial, useMaterial, useProvideTranscript } from "@/features/instructor/hooks/use-materials";

function secToLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** No captions could be fetched for the video: the instructor can paste a transcript or notes instead. */
function TranscriptFallback({ classId, id }: { classId: string; id: string }) {
  const toast = useToast();
  const provide = useProvideTranscript(classId, id);
  const [text, setText] = useState("");

  const save = async () => {
    const result = await provide.run(text);
    if (!result.ok) toast.show(result.error.message, { tone: "red" });
    else toast.show("Transcript saved. The AI is summarising it.", { tone: "green" });
  };

  return (
    <Card>
      <Badge label="No captions could be fetched for this video" tone="red" />
      <Text style={[TYPE.muted, { marginTop: SPACE.sm }]}>
        Paste the transcript or your lecture notes and the AI will build the summary and key objectives from them.
      </Text>
      <View style={{ marginTop: SPACE.sm, gap: SPACE.sm }}>
        <FormField label="Transcript or notes" value={text} onChangeText={setText} multiline maxLength={50000} placeholder="One idea per line works best" />
        <ActionButton label="Save and summarise" icon="sparkles-outline" loading={provide.loading} onPress={save} />
      </View>
    </Card>
  );
}

export default function MaterialDetailScreen() {
  const { classId, id } = useRouteIds("classId", "id");
  const router = useRouter();
  const goBack = useSafeBack(classId ? { pathname: "/instructor/class-detail", params: { id: classId } } : "/instructor/classes");
  const openFile = useOpenFile("instructor");
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
            {material.link ? (
              <VideoLinkCard link={material.link} />
            ) : material.attachment ? (
              <>
                <View style={s.placeholder}>
                  <IconTile
                    name={material.kind === "slide" ? "easel-outline" : "document-text-outline"}
                    size={56}
                    bg={OVERLAY.tile}
                    color={C.white}
                  />
                  <Text style={s.placeholderText}>{material.attachment.name}</Text>
                </View>
                <AttachmentRow attachment={material.attachment} onPress={() => openFile(material.attachment!.id)} />
              </>
            ) : null}

            {material.processing === "processing" ? (
              <Badge label="AI is extracting the transcript and key objectives..." tone="orange" />
            ) : material.processing === "failed" ? (
              <TranscriptFallback classId={material.classId} id={material.id} />
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
