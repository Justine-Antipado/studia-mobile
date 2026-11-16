import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { ActionButton, ListCard, Pill, TabChips, t } from "@/components/ui/parts";
import { Screen } from "@/components/ui/screen";
import { C } from "@/constants/studia-colors";
import { QUIZZES, type QuizStatus } from "@/lib/mock-data";

const TABS = ["Quizzes", "Submissions", "Gradebook"] as const;
const STATUS_TONE: Record<QuizStatus, "orange" | "blue" | "green" | "purple"> = {
  to_grade: "orange",
  scheduled: "blue",
  graded: "green",
  draft: "purple",
};

export default function InstructorAssessments() {
  const [tab, setTab] = useState<string>("Quizzes");

  return (
    <Screen role="instructor">
      <TabChips items={TABS} value={tab} onChange={setTab} />

      {/* AI Quiz Synthesizer Banner */}
      <View style={s.banner}>
        <View style={s.badge}>
          <Ionicons name="sparkles" size={12} color={C.white} />
          <Text style={s.badgeText}>AI Quiz Synthesizer</Text>
        </View>
        <Text style={s.bannerTitle}>Generate a quiz from a lesson</Text>
        <Text style={s.bannerSub}>Pick a lesson, question types, count and difficulty</Text>
        <ActionButton
          label="Start synthesizer"
          variant="secondary"
          onPress={() => Alert.alert("AI Synthesizer", "Select lesson & item count")}
        />
      </View>

      <ActionButton label="Create Quiz Manually" icon="add" onPress={() => Alert.alert("New Quiz", "Open manual quiz editor")} />

      <Text style={t.h2}>Quizzes</Text>
      {QUIZZES.map((q) => (
        <ListCard
          key={q.id}
          icon="document-text-outline"
          title={q.title}
          meta={q.meta}
          right={<Pill text={q.label} tone={STATUS_TONE[q.status]} />}
          onPress={() => {}}
        />
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: C.primaryDark, borderRadius: 22, padding: 18, gap: 10 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.16)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: C.white, fontSize: 11, fontFamily: "Poppins_600SemiBold" },
  bannerTitle: { color: C.white, fontSize: 18, fontFamily: "Poppins_700Bold" },
  bannerSub: { color: C.lavender, fontSize: 12.5, fontFamily: "Poppins_400Regular", marginBottom: 4 },
});