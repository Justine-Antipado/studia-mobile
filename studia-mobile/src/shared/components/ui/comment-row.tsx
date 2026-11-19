// comment-row.tsx — one comment on an announcement. Shared by both roles: students may delete
// their own comment, instructors may moderate any of them, which is the `canDelete` prop.
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Comment } from "@/core/types/content";
import { Avatar } from "@/shared/components/ui/avatar";
import { Icon } from "@/shared/components/ui/icon";
import { C } from "@/shared/constants/studia-colors";
import { HIT_SLOP, SPACE, TYPE } from "@/shared/constants/tokens";
import { timeAgo } from "@/shared/utils/format";

export const CommentRow = memo(function CommentRow({
  comment,
  onDelete,
  canDelete = "own",
}: {
  comment: Comment;
  onDelete?: () => void;
  /** "own" = only the author's own comment (student), "any" = moderation (instructor). */
  canDelete?: "own" | "any";
}) {
  const deletable = !!onDelete && (canDelete === "any" || comment.authorIsMe);

  return (
    <View style={s.row}>
      <Avatar name={comment.author} size={32} />
      <View style={s.body}>
        <View style={s.head}>
          <Text style={TYPE.bodyStrong} numberOfLines={1}>
            {comment.author}
          </Text>
          <Text style={TYPE.caption}>{timeAgo(comment.postedAt)}</Text>
        </View>
        {/* Plain Text: comment bodies are never rendered as markup. */}
        <Text style={TYPE.body}>{comment.text}</Text>
      </View>
      {deletable ? (
        <Pressable
          onPress={onDelete}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`Delete comment by ${comment.author}`}
        >
          <Icon name="trash-outline" size="sm" color={C.muted} />
        </Pressable>
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: SPACE.sm + 2, alignItems: "flex-start" },
  body: { flex: 1, gap: 2 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.sm,
  },
});
