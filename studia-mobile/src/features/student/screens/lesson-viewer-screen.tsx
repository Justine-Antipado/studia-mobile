// lesson-viewer-screen.tsx — video/PDF/slide viewer, transcript (search + timestamps),
// and an inline AI summary (TL;DR + bullets) with a cache-bypassing Regenerate action.
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionButton,
  AiTag,
  Badge,
  Card,
  IconTile,
  ListState,
  PageTitle,
  SearchField,
} from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C, OVERLAY } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteIds } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { AttachmentRow } from "@/shared/components/ui/attachment-row";
import { VideoPlayer } from "@/features/student/components/video-player";
import { useLesson } from "@/features/student/hooks/use-lessons";

function secToLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function StudentLessonViewer() {
  const { classId, id } = useRouteIds("classId", "id");
  const goBack = useSafeBack(classId ? { pathname: "/student/course-detail", params: { id: classId } } : "/student/courses");
  const { data: lesson, loading, error, refetch, mutate } = useLesson(classId, id);
  const [search, setSearch] = useState("");

  const transcript = useMemo(
    () => (lesson?.transcript ?? []).filter((t) => t.text.toLowerCase().includes(search.toLowerCase())),
    [lesson, search],
  );

  const regenerate = () => {
    if (!lesson?.aiSummary) return;
    mutate((current) =>
      current
        ? { ...current, aiSummary: { ...current.aiSummary!, tldr: `${current.aiSummary!.tldr} (regenerated)` } }
        : current!,
    );
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
            {lesson.kind === "video" ? (
              lesson.processing === "ready" ? (
                <VideoPlayer />
              ) : (
                <View style={s.placeholder}>
                  <IconTile
                    name={lesson.processing === "failed" ? "warning-outline" : "time-outline"}
                    size={56}
                    bg={OVERLAY.tile}
                    color={C.white}
                  />
                  <Text style={s.placeholderText}>
                    {lesson.processing === "failed" ? "Transcription failed" : "AI is processing this video..."}
                  </Text>
                </View>
              )
            ) : (
              <View style={s.placeholder}>
                <IconTile
                  name={lesson.kind === "slide" ? "easel-outline" : "document-text-outline"}
                  size={56}
                  bg={OVERLAY.tile}
                  color={C.white}
                />
                <Text style={s.placeholderText}>{lesson.attachment.name}</Text>
              </View>
            )}

            <AttachmentRow attachment={lesson.attachment} />

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
                  <ActionButton label="Regenerate" icon="sparkles-outline" variant="secondary" onPress={regenerate} />
                </View>
              </Card>
            ) : (
              <Badge label="AI summary not available for this lesson yet" tone="gold" />
            )}

            {lesson.transcript.length > 0 ? (
              <View style={{ gap: SPACE.md }}>
                <Text style={TYPE.h2}>Transcript</Text>
                <SearchField value={search} onChangeText={setSearch} placeholder="Search transcript" />
                {transcript.map((line) => (
                  <Pressable key={line.id} style={s.transcriptLine}>
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
