import { useRouter } from "expo-router";
import { Alert, Text } from "react-native";

import { ActionButton, ListCard, ProgressBar, t } from "@/components/ui/parts";
import { Screen } from "@/components/ui/screen";
import { STUDENT_COURSES } from "@/lib/mock-data";

export default function StudentCourses() {
  const router = useRouter();

  return (
    <Screen role="student">
      <Text style={t.h1}>Courses</Text>
      <ActionButton label="Join Class" icon="add" onPress={() => Alert.alert("Join Class", "Enter 6-character class code")} />

      {STUDENT_COURSES.map((c) => (
        <ListCard
          key={c.id}
          icon="book-outline"
          eyebrow={c.code}
          title={c.title}
          meta={c.teacher}
          footer={<ProgressBar value={c.progress} />}
          onPress={() => router.push({ pathname: "/student/course-detail", params: { id: c.id } })}
        />
      ))}
    </Screen>
  );
}