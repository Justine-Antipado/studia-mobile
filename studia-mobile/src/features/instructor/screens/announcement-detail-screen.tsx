// announcement-detail-screen.tsx — announcement body + comments (post as instructor, delete any),
// delete the announcement itself.
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Avatar, Badge, Card, CommentComposer, ConfirmDialog, ListState, PageTitle, SectionHeader, useToast } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteIds } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { CommentRow } from "@/shared/components/ui/comment-row";
import { timeAgo } from "@/features/instructor/logic/format";
import { validateCommentText } from "@/features/student/logic/validators";
import { useAddComment, useAnnouncement, useDeleteAnnouncement, useDeleteComment } from "@/features/instructor/hooks/use-announcements";

export default function InstructorAnnouncementDetailScreen() {
  const { classId, id } = useRouteIds("classId", "id");
  const router = useRouter();
  const toast = useToast();
  const goBack = useSafeBack(classId ? { pathname: "/instructor/class-detail", params: { id: classId } } : "/instructor/classes");
  const { data: announcement, loading, error, refetch } = useAnnouncement(classId, id);
  const addComment = useAddComment(classId ?? "", id ?? "");
  const deleteComment = useDeleteComment(classId ?? "", id ?? "");
  const deleteAnnouncement = useDeleteAnnouncement(classId ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const removeAnnouncement = async () => {
    if (!id) return;
    const result = await deleteAnnouncement.run(id);
    setConfirmDelete(false);
    if (result.ok && classId) router.replace({ pathname: "/instructor/class-detail", params: { id: classId } });
  };

  return (
    <Screen role="instructor" scope="instructor/announcement-detail">
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
              <Text style={[TYPE.caption, { marginTop: 4 }]}>{timeAgo(announcement.postedAt)}</Text>
              <Text style={[TYPE.body, { marginTop: SPACE.sm }]}>{announcement.body}</Text>
            </Card>

            <View style={{ gap: SPACE.md }}>
              <SectionHeader title={`Comments (${announcement.comments.length})`} />
              {announcement.comments.map((c) => (
                <CommentRow
              canDelete="any"
                  key={c.id}
                  comment={c}
                  onDelete={() =>
                    void deleteComment.run(c.id).then((r) => {
                      if (!r.ok) toast.show(r.error.message, { tone: "red" });
                    })
                  }
                />
              ))}
            </View>

            <CommentComposer validate={validateCommentText} onSubmit={addComment.run} loading={addComment.loading} />

            <ActionButton label="Delete announcement" icon="trash-outline" variant="danger" onPress={() => setConfirmDelete(true)} />
          </View>
        ) : null}
      </ListState>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this announcement?"
        message="Students will no longer see it or its comments."
        confirmLabel="Delete"
        busy={deleteAnnouncement.loading}
        onConfirm={removeAnnouncement}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}
