// lesson-viewer-screen.tsx — video LINK (YouTube thumbnail + Watch on YouTube) / PDF / slide viewer, transcript (search + timestamps),
// and an inline AI summary (TL;DR + bullets) with a cache-bypassing Regenerate action.
import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionButton,
  AiTag,
  Badge,
  Card,
  IconTile,
  ListState,
  PageTitle,
  SearchField,
  VideoLinkCard,
  useToast,
} from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C, OVERLAY } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteIds } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { AttachmentRow } from "@/shared/components/ui/attachment-row";
import { useLesson, useRegenerateSummary } from "@/features/student/hooks/use-lessons";

function secToLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function StudentLessonViewer() {
  const { classId, id } = useRouteIds("classId", "id");
  const goBack = useSafeBack(classId ? { pathname: "/student/course-detail", params: { id: classId } } : "/student/courses");
  const toast = useToast();
  const { data: lesson, loading, error, refetch } = useLesson(classId, id);
  const regenerateSummary = useRegenerateSummary(classId ?? "", id ?? "");
  const [search, setSearch] = useState("");

  const transcript = useMemo(
    () => (lesson?.transcript ?? []).filter((t) => t.text.toLowerCase().includes(search.toLowerCase())),
    [lesson, search],
  );

  const regenerate = async () => {
    const result = await regenerateSummary.run(undefined);
    if (!result.ok) toast.show(result.error.message, { tone: "red" });
    else toast.show("Summary regenerated", { tone: "green" });
  };

  // YouTube lines can jump to their timestamp; other sources have no player to seek.
  const seek = (sec: number) => {
    if (lesson?.link?.provider !== "youtube") return;
    void Linking.openURL(`${lesson.link.url}&t=${Math.floor(sec)}s`).catch(() => {
      toast.show("Could not open the link.", { tone: "red" });
    });
  };

  return (
    <Screen role="student" scope="student/lesson-viewer">
      <PageTitle title={lesson?.title ?? "Lesson"} onBack={goBack} />
      <ListState
        loading={loading}
        error={error}
        empty={!loading && !lesson}
        onRetry={refetch}
        emptyIcon="play-circle-outline"
        emptyTitle="Lesson not found"
      >
        {lesson ? (
          <View style={{ gap: SPACE.lg }}>
            {lesson.link ? (
              <VideoLinkCard link={lesson.link} />
            ) : lesson.attachment ? (
              <View style={s.placeholder}>
                <IconTile
                  name={lesson.kind === "slide" ? "easel-outline" : "document-text-outline"}
                  size={56}
                  bg={OVERLAY.tile}
                  color={C.white}
                />
                <Text style={s.placeholderText}>{lesson.attachment.name}</Text>
              </View>
            ) : null}

            {lesson.attachment ? <AttachmentRow attachment={lesson.attachment} /> : null}

            {lesson.processing === "processing" ? (
              <Badge label="AI is preparing the transcript and summary..." tone="gold" />
            ) : lesson.processing === "failed" ? (
              <Badge label="No transcript could be fetched for this video. Ask your instructor to add one." tone="red" />
            ) : null}

            {lesson.aiSummary ? (
              <Card>
                <AiTag text="AI-generated summary" />
                <Text style={[TYPE.body, { marginTop: SPACE.sm }]}>{lesson.aiSummary.tldr}</Text>
                <View style={{ gap: 4, marginTop: SPACE.sm }}>
                  {lesson.aiSummary.bullets.map((b, i) => (
                    <Text key={i} style={TYPE.muted}>
                      • {b}
                    </Text>
                  ))}
                </View>
                <View style={{ marginTop: SPACE.md }}>
                  <ActionButton
                    label={`Regenerate (${lesson.regensLeft} left)`}
                    icon="sparkles-outline"
                    variant="secondary"
                    disabled={lesson.regensLeft === 0}
                    loading={regenerateSummary.loading}
                    onPress={regenerate}
                  />
                </View>
              </Card>
            ) : (
              lesson.processing === "ready" ? <Badge label="AI summary not available for this lesson yet" tone="gold" /> : null
            )}

            {lesson.transcript.length > 0 ? (
              <View style={{ gap: SPACE.md }}>
                <Text style={TYPE.h2}>Transcript</Text>
                <SearchField value={search} onChangeText={setSearch} placeholder="Search transcript" />
                {transcript.map((line) => (
                  <Pressable
                    key={line.id}
                    style={s.transcriptLine}
                    onPress={() => seek(line.startSec)}
                    disabled={lesson.link?.provider !== "youtube"}
                    accessibilityRole={lesson.link?.provider === "youtube" ? "button" : undefined}
                    accessibilityLabel={`${secToLabel(line.startSec)} ${line.text}`}
                  >
                    <Text style={TYPE.eyebrow}>{secToLabel(line.startSec)}</Text>
                    <Text style={TYPE.body}>{line.text}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ListState>
    </Screen>
  );
}

const s = StyleSheet.create({
  placeholder: {
    height: 185,
    backgroundColor: C.primaryDark,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
  },
  placeholderText: { color: C.white, fontFamily: "Poppins_600SemiBold", fontSize: 13 },
  transcriptLine: { flexDirection: "row", gap: SPACE.sm + 2, paddingVertical: 6 },
});
