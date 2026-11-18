// home.tsx

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ListCard, QuickAction, SectionHeader, t } from "@/shared/components/ui/parts";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
// TODO(refactor): route through data/ layer
import { STUDENT_COURSES } from "@/core/data/mock/mock-data";
import { displayName, useRoleUser } from "@/core/data/storage/session-store";

export default function StudentHome() {
  const user = useRoleUser("student");
  const router = useRouter();
  const [showNotice, setShowNotice] = useState(true);

  return (
    <Screen role="student">
      <View>
        <Text style={t.muted}>Good morning</Text>
        <Text style={t.h1}>{user ? displayName(user) : "Juan Dela Cruz"}</Text>
      </View>

      <View style={s.qaRow}>
        <QuickAction
          icon="book-outline"
          label="My Courses"
          onPress={() => router.push("/student/courses")}
        />
        <QuickAction
          icon="sparkles-outline"
          label="AI Assistant"
          onPress={() => router.push("/student/ai")}
        />
        <QuickAction
          icon="document-text-outline"
          label="Quizzes"
          onPress={() => router.push("/student/notifications")}
        />
        <QuickAction
          icon="bar-chart-outline"
          label="Grades"
          onPress={() => router.push("/student/notifications")}
        />
      </View>

      {showNotice && (
        <ListCard
          icon="megaphone-outline"
          title="Midterm exam schedule"
          meta="Nov 10–14, 2026 · tap to read"
          right={
            <Pressable onPress={() => setShowNotice(false)} hitSlop={8}>
              <Ionicons name="close" size={18} color={C.muted} />
            </Pressable>
          }
          onPress={() => router.push("/student/notifications")}
        />
      )}

      <SectionHeader
        title="My Courses"
        action="View All"
        onAction={() => router.push("/student/courses")}
      />
      {STUDENT_COURSES.slice(0, 2).map((c) => (
        <ListCard
          key={c.id}
          icon="book-outline"
          eyebrow={c.code}
          title={c.title}
          meta={c.teacher}
          onPress={() =>
            router.push({
              pathname: "/student/course-detail",
              params: { id: c.id },
            })
          }
        />
      ))}

      <ListCard
        icon="calendar-outline"
        title="Today's tasks"
        meta="Quiz 2 due 5:00 PM · 3 tasks"
        onPress={() => router.push("/student/notifications")}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  qaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    rowGap: 10,
    paddingVertical: 4,
  },
});
