// search-screen.tsx — modal: search across classes and tasks (debounced 300ms).
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { EmptyState, ListRow, PageTitle, SearchField } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE } from "@/shared/constants/tokens";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { dueLabel } from "@/features/student/logic/format";
import { useClasses } from "@/features/student/hooks/use-classes";
import { useTasks } from "@/features/student/hooks/use-tasks";

export default function StudentSearch() {
  const router = useRouter();
  const goBack = useSafeBack("/student/home");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const classes = useClasses();
  const tasks = useTasks();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const matchedClasses = debounced
    ? (classes.data ?? []).filter((c) => `${c.code} ${c.title}`.toLowerCase().includes(debounced))
    : [];
  const matchedTasks = debounced
    ? (tasks.data ?? []).filter((t) => t.title.toLowerCase().includes(debounced))
    : [];

  return (
    <Screen role="student" scope="student/search">
      <PageTitle title="Search" onBack={goBack} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search classes and tasks" autoFocus />

      {!debounced ? (
        <EmptyState icon="search-outline" title="Search your classes and tasks" />
      ) : matchedClasses.length === 0 && matchedTasks.length === 0 ? (
        <EmptyState icon="search-outline" title="No results" message={`Nothing matches "${debounced}"`} />
      ) : (
        <View style={{ gap: SPACE.md }}>
          {matchedClasses.map((c) => (
            <ListRow
              key={c.id}
              icon="book-outline"
              eyebrow={c.code}
              title={c.title}
              onPress={() => router.push({ pathname: "/student/course-detail", params: { id: c.id } })}
            />
          ))}
          {matchedTasks.map((t) => (
            <ListRow
              key={t.id}
              icon={t.kind === "quiz" ? "help-circle-outline" : "document-text-outline"}
              title={t.title}
              subtitle={`${t.classCode} · ${dueLabel(t.dueAt)}`}
              onPress={() =>
                router.push(
                  t.kind === "assignment"
                    ? { pathname: "/student/assignment-detail", params: { classId: t.classId, id: t.refId } }
                    : { pathname: "/student/quiz-take", params: { classId: t.classId, quizId: t.refId } },
                )
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
