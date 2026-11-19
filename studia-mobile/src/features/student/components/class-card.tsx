// class-card.tsx — one row in the Courses list and the Home "My Courses" section.
import { memo } from "react";

import { ListRow, ProgressBar } from "@/shared/components/ui";
import type { StudentClass } from "@/features/student/types/student";

export const ClassCard = memo(function ClassCard({
  item,
  onPress,
}: {
  item: StudentClass;
  onPress: () => void;
}) {
  return (
    <ListRow
      icon="book-outline"
      eyebrow={item.code}
      title={item.title}
      subtitle={item.teacher}
      onPress={onPress}
      footer={<ProgressBar value={item.progress} />}
    />
  );
});
