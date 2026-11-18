import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ActionButton, AiTag, BackTitle, ListCard, TabChips, shadow, t } from "@/shared/components/ui/parts";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
// TODO(refactor): route through data/ layer
import { STUDENT_COURSES } from "@/core/data/mock/mock-data";

const TABS = ["Lessons", "Materials", "Quizzes", "Notices", "Grades"] as const;

export default function StudentCourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const course = STUDENT_COURSES.find((c) => c.id === id) ?? STUDENT_COURSES[0]!;
  const [tab, setTab] = useState<string>("Lessons");

  return (
    <Screen role="student">
      <BackTitle title={`${course.code} – ${course.title}`} onBack={() => router.back()} />
      <TabChips items={TABS} value={tab} onChange={setTab} />

      {/* Video Player Placeholder */}
      <Pressable onPress={() => Alert.alert("Video Player", "Playing Lesson 3...")} style={s.videoBox}>
        <View style={s.playCircle}>
          <Ionicons name="play" size={28} color={C.white} style={{ marginLeft: 3 }} />
        </View>
      </Pressable>

      <Text style={t.h2}>Lesson 3: Network Security Basics</Text>

      {/* AI-generated Summary Card */}
      <View style={s.summaryCard}>
        <AiTag text="AI-generated summary" />
        <Text style={s.summaryBody}>
          Covers firewalls, intrusion detection and the CIA triad. Emphasizes layered defense and access control.
        </Text>
        <View style={s.bullets}>
          <Text style={t.muted}>• Confidentiality, integrity, availability</Text>
          <Text style={t.muted}>• Firewalls filter traffic by rules</Text>
          <Text style={t.muted}>• IDS detects suspicious activity</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={s.btnRow}>
        <ActionButton label="Regenerate" icon="sparkles-outline" variant="secondary" style={{ flex: 1 }} onPress={() => {}} />
        <ActionButton label="Transcript" style={{ flex: 1 }} onPress={() => {}} />
      </View>

      {/* Attached PDF */}
      <ListCard icon="document-outline" title="Lesson3_Slides.pdf" meta="PDF · 2.4 MB · Preview" onPress={() => {}} />
    </Screen>
  );
}

const s = StyleSheet.create({
  videoBox: { height: 185, backgroundColor: C.primaryDark, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  playCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: C.white, alignItems: "center", justifyContent: "center" },
  summaryCard: { backgroundColor: C.white, borderRadius: 18, padding: 16, gap: 10, ...shadow },
  summaryBody: { color: C.text, fontSize: 13.5, lineHeight: 20, fontFamily: "Poppins_400Regular" },
  bullets: { gap: 4 },
  btnRow: { flexDirection: "row", gap: 10 },
});