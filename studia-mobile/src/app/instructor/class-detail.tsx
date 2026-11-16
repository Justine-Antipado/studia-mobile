import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";

import { Avatar, BackTitle, ListCard, SearchField, TabChips } from "@/components/ui/parts";
import { Screen } from "@/components/ui/screen";
import { CLASS_STUDENTS, INSTRUCTOR_CLASSES } from "@/lib/mock-data";

const TABS = ["Stream", "Lessons", "Materials", "Quizzes", "Students"] as const;

export default function InstructorClassDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cls = INSTRUCTOR_CLASSES.find((c) => c.id === id) ?? INSTRUCTOR_CLASSES[0]!;

  const [tab, setTab] = useState<string>("Students");
  const [search, setSearch] = useState("");

  const filtered = CLASS_STUDENTS.filter((st) => st.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Screen role="instructor">
      <BackTitle title={`${cls.code} · ${cls.section}`} onBack={() => router.back()} />
      <TabChips items={TABS} value={tab} onChange={setTab} />
      <SearchField value={search} onChangeText={setSearch} placeholder="Search students" />

      {filtered.map((st) => (
        <ListCard
          key={st.id}
          icon="person-outline"
          title={st.name}
          meta={`${st.section} · ${st.progress}% progress`}
          right={<Text />} // Hides chevron if desired, or keep default
        />
      ))}
    </Screen>
  );
}