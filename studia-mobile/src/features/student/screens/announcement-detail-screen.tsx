// announcement-detail-screen.tsx — announcement body + comments (add/delete own comment).
import { Text, View } from "react-native";

import { Avatar, Badge, Card, CommentComposer, ListState, PageTitle, SectionHeader, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteIds } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { CommentRow } from "@/shared/components/ui/comment-row";
import { dueLabel as postedLabel } from "@/features/student/logic/format";
import { validateCommentText } from "@/features/student/logic/validators";
import { useAddComment, useAnnouncement, useDeleteComment } from "@/features/student/hooks/use-announcements";

export default function StudentAnnouncementDetail() {
  const { classId, id } = useRouteIds("classId", "id");
  const goBack = useSafeBack(classId ? { pathname: "/student/course-detail", params: { id: classId } } : "/student/courses");
  const toast = useToast();
  const { data: announcement, loading, error, refetch } = useAnnouncement(classId, id);
  const addComment = useAddComment(classId ?? "", id ?? "");
  const deleteComment = useDeleteComment(classId ?? "", id ?? "");

  return (
    <Screen role="student" scope="student/announcement-detail">
      <PageTitle title="Announcement" onBack={goBack} />
      <ListState
        loading={loading}
        error={error}
        empty={!loading && !announcement}
        onRetry={refetch}
        emptyIcon="megaphone-outline"
        emptyTitle="Announcement not found"
      >
        {announcement ? (
          <View style={{ gap: SPACE.lg }}>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                <Avatar name={announcement.authorName} userId={announcement.authorId} size={32} />
                <Text style={[TYPE.bodyStrong, { flex: 1 }]} numberOfLines={1}>
                  {announcement.authorName}
                </Text>
                <Badge label="Instructor" tone="primary" />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: SPACE.sm }}>
                <Text style={TYPE.h2} numberOfLines={3}>
                  {announcement.title}
                </Text>
                {announcement.pinned ? <Badge label="Pinned" tone="gold" /> : null}
              </View>
              <Text style={[TYPE.caption, { marginTop: 4 }]}>{postedLabel(announcement.postedAt)}</Text>
              <Text style={[TYPE.body, { marginTop: SPACE.sm }]}>{announcement.body}</Text>
            </Card>

            <View style={{ gap: SPACE.md }}>
              <SectionHeader title={`Comments (${announcement.comments.length})`} />
              {announcement.comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  onDelete={
                    c.authorIsMe
                      ? () =>
                          void deleteComment.run(c.id).then((r) => {
                            if (!r.ok) toast.show(r.error.message, { tone: "red" });
                          })
                      : undefined
                  }
                />
              ))}
            </View>

            <CommentComposer validate={validateCommentText} onSubmit={addComment.run} loading={addComment.loading} />
          </View>
        ) : null}
      </ListState>
    </Screen>
  );
}
