// people-tab.tsx — Course detail "People" tab: instructor + classmates, with Leave class.
import { useState } from "react";
import { View } from "react-native";

import { ActionButton, ConfirmDialog, ListRow, SectionHeader } from "@/shared/components/ui";
import { SPACE } from "@/shared/constants/tokens";
import { CLASSMATES, classFacts } from "@/features/student/data/class-directory";
import { useLeaveClass } from "@/features/student/hooks/use-classes";

export function PeopleTab({ classId, onLeft }: { classId: string; onLeft: () => void }) {
  const facts = classFacts(classId);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const leaveClass = useLeaveClass();

  const confirmedLeave = async () => {
    const result = await leaveClass.run(classId);
    setConfirmLeave(false);
    if (result.ok) onLeft();
  };

  return (
    <View style={{ gap: SPACE.lg }}>
      <View>
        <SectionHeader title="Instructor" />
        {facts ? (
          <ListRow icon="school-outline" title={facts.teacher} subtitle="Instructor" flat />
        ) : null}
      </View>

      <View style={{ gap: SPACE.md }}>
        <SectionHeader title="Classmates" />
        {CLASSMATES.map((person) => (
          <ListRow key={person.id} icon="person-outline" title={person.name} subtitle="Student" flat />
        ))}
      </View>

      <ActionButton label="Leave class" icon="exit-outline" variant="danger" onPress={() => setConfirmLeave(true)} />

      <ConfirmDialog
        visible={confirmLeave}
        title="Leave this class?"
        message="You will lose access to its lessons, assignments and grades unless you join again with the class code."
        confirmLabel="Leave"
        busy={leaveClass.loading}
        onConfirm={confirmedLeave}
        onCancel={() => setConfirmLeave(false)}
      />
    </View>
  );
}
