import { useRouter } from "expo-router";
import { Alert, Text } from "react-native";

import { ActionButton, ListCard, t } from "@/shared/components/ui/parts";
import { Screen } from "@/shared/components/ui/screen";
// TODO(refactor): route through data/ layer
import { INSTRUCTOR_CLASSES } from "@/core/data/mock/mock-data";

export default function InstructorClasses() {
  const router = useRouter();

  return (
    <Screen role="instructor">
      <Text style={t.h1}>Classes</Text>
      <ActionButton label="Create Class" icon="add" onPress={() => Alert.alert("Create Class", "Modal for new class code & section")} />

      {INSTRUCTOR_CLASSES.map((c) => (
        <ListCard
          key={c.id}
          icon="book-outline"
          eyebrow={`${c.code} · ${c.section}`}
          title={c.title}
          meta={`${c.students} students · Code: ${c.joinCode}`}
          onPress={() => router.push({ pathname: "/instructor/class-detail", params: { id: c.id } })}
        />
      ))}

      <ListCard
        icon="library-outline"
        title="Create Book / Module"
        meta="Group lessons, files and quizzes"
        onPress={() => Alert.alert("Module Builder", "Group your lessons into a module")}
      />
    </Screen>
  );
}