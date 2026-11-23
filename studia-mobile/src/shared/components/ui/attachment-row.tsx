// attachment-row.tsx — one file row (assignment brief, submitted file, lesson material).
// Shared by both roles: the student and instructor copies were identical.
import { memo } from "react";
import { Pressable } from "react-native";

import type { Attachment, AttachmentKind } from "@/core/types/content";
import { Icon, type IconName } from "@/shared/components/ui/icon";
import { ListRow } from "@/shared/components/ui/list-row";
import { C } from "@/shared/constants/studia-colors";
import { HIT_SLOP } from "@/shared/constants/tokens";

const ICON_BY_KIND: Record<AttachmentKind, IconName> = {
  pdf: "document-text-outline",
  doc: "document-outline",
  slide: "easel-outline",
  video: "videocam-outline",
  image: "image-outline",
};

export const AttachmentRow = memo(function AttachmentRow({
  attachment,
  onPress,
  onRemove,
}: {
  attachment: Attachment;
  onPress?: () => void;
  /** Shows a remove button (draft attachments on a form). */
  onRemove?: () => void;
}) {
  return (
    <ListRow
      icon={ICON_BY_KIND[attachment.kind]}
      title={attachment.name}
      subtitle={attachment.sizeLabel}
      onPress={onPress}
      flat
      chevron={!onRemove}
      trailing={
        onRemove ? (
          <Pressable
            onPress={onRemove}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${attachment.name}`}
          >
            <Icon name="close-circle-outline" size="md" color={C.muted} />
          </Pressable>
        ) : undefined
      }
    />
  );
});
