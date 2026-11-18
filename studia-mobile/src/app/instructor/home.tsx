// home.tsx

import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  ListCard,
  QuickAction,
  SectionHeader,
  StatCard,
  t,
} from "@/components/ui/parts";
import { Screen } from "@/components/ui/screen";
import { C } from "@/constants/studia-colors";
import { INSTRUCTOR_CLASSES } from "@/lib/mock-data";
import { greetName, useRoleUser } from "@/lib/session-store";

export default function InstructorHome() {
  const user = useRoleUser("instructor");
  const router = useRouter();

  return (
    <Screen role="instructor">
      <View>
        <Text style={t.muted}>Welcome back</Text>
        <Text style={t.h1}>
          {user ? greetName(user) : "Prof. Maria Santos"}
        </Text>
      </View>

      <View style={s.statsRow}>
        <StatCard label="Classes" value={4} />
        <StatCard label="Students" value={128} />
        <StatCard label="To Grade" value={12} tone="orange" />
      </View>

      <View style={s.qaRow}>
        <QuickAction
          icon="people-outline"
          label="My Classes"
          onPress={() => router.push("/instructor/classes")}
        />
        <QuickAction
          icon="create-outline"
          label="Create Quiz"
          onPress={() => router.push("/instructor/assessments")}
        />
        <QuickAction
          icon="bar-chart-outline"
          label="Gradebook"
          onPress={() => router.push("/instructor/assessments")}
        />
        <QuickAction
          icon="sparkles-outline"
          label="AI Quiz"
          onPress={() => router.push("/instructor/assessments")}
        />
      </View>

      <ListCard
        icon="document-text-outline"
        title="Needs Grading"
        meta="12 submissions · Quiz 2, IT 321 · Due for review today"
        iconBg={`${C.orange}26`}
        iconColor={C.orange}
        style={{ backgroundColor: `${C.orange}14` }}
        onPress={() => router.push("/instructor/assessments")}
      />

      <SectionHeader
        title="My Classes"
        action="View All"
        onAction={() => router.push("/instructor/classes")}
      />
      {INSTRUCTOR_CLASSES.slice(0, 2).map((c) => (
        <ListCard
          key={c.id}
          icon="book-outline"
          eyebrow={`${c.code} · ${c.section}`}
          title={c.title}
          meta={`${c.students} students`}
          onPress={() =>
            router.push({
              pathname: "/instructor/class-detail",
              params: { id: c.id },
            })
          }
        />
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  statsRow: { flexDirection: "row", gap: 10 },
  qaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    rowGap: 10,
    paddingVertical: 4,
  },
});
