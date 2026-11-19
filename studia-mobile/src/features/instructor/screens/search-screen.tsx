// search-screen.tsx — modal: search across classes and quizzes (debounced 300ms).
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { EmptyState, ListRow, PageTitle, SearchField } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { useInstructorClasses } from "@/features/instructor/hooks/use-classes";
import { useQuizzes } from "@/features/instructor/hooks/use-quizzes";

export default function InstructorSearchScreen() {
  const router = useRouter();
  const goBack = useSafeBack("/instructor/home");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const classes = useInstructorClasses();
  const quizzes = useQuizzes();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const matchedClasses = debounced
    ? (classes.data ?? []).filter((c) => `${c.code} ${c.title}`.toLowerCase().includes(debounced))
    : [];
  const matchedQuizzes = debounced
    ? (quizzes.data ?? []).filter((q) => `${q.title} ${q.classCode}`.toLowerCase().includes(debounced))
    : [];

  return (
    <Screen role="instructor" scope="instructor/search">
      <PageTitle title="Search" onBack={goBack} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search classes and quizzes" autoFocus />

      {!debounced ? (
        <EmptyState icon="search-outline" title="Search your classes and quizzes" />
      ) : matchedClasses.length === 0 && matchedQuizzes.length === 0 ? (
        <EmptyState icon="search-outline" title="No results" message={`Nothing matches "${debounced}"`} />
      ) : (
        <View style={{ gap: SPACE.md }}>
          {matchedClasses.map((c) => (
            <ListRow
              key={c.id}
              icon="book-outline"
              eyebrow={c.code}
              title={c.title}
              onPress={() => router.push({ pathname: "/instructor/class-detail", params: { id: c.id } })}
            />
          ))}
          {matchedQuizzes.map((q) => (
            <ListRow
              key={q.id}
              icon="help-circle-outline"
              eyebrow={q.classCode}
              title={q.title}
              onPress={() => router.push({ pathname: "/instructor/quiz-detail", params: { id: q.id } })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
