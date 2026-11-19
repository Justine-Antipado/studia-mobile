import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Button, Chip, Field, Page, PageTitle } from "@/features/instructor/components/instructor-ui";
import { QuestionEditor } from "@/features/instructor/components/question-editor";
import { addQuiz, useInstructorClasses } from "@/features/instructor/data/instructor-store";
import { blankQuestion } from "@/features/instructor/logic/quiz-validation";
import type { QuizQuestion } from "@/features/instructor/types/instructor";
import { Screen } from "@/shared/components/ui/screen";
import { TONES } from "@/shared/constants/studia-colors";
import { useSafeBack } from "@/shared/hooks/use-safe-back";

export default function CreateQuizScreen() {
  const goBack = useSafeBack();
  const classes = useInstructorClasses();
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState<string | null>(classes[0]?.id ?? null);
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => [blankQuestion()]);
  const [error, setError] = useState<string | null>(null);

  const change = useCallback(
    (id: string, patch: Partial<QuizQuestion>) =>
      setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q))),
    [],
  );
  const remove = useCallback((id: string) => setQuestions((qs) => qs.filter((q) => q.id !== id)), []);

  const submit = (publish: boolean) => {
    const res = addQuiz({ title, classId, questions, source: "manual" }, publish);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    Alert.alert(publish ? "Quiz published" : "Draft saved", `"${title.trim()}" was ${publish ? "published" : "saved as a draft"}.`, [
      { text: "OK", onPress: goBack },
    ]);
  };

  return (
    <Screen role="instructor">
      <Page>
        <PageTitle title="Create Quiz" subtitle="Multiple choice, one correct answer each." onBack={goBack} />

        <Field label="Quiz title" value={title} onChangeText={setTitle} placeholder="e.g. Quiz 3: Risk Management" maxLength={80} />

        <View style={s.group}>
          <Text style={s.label}>Class</Text>
          <View style={s.chips}>
            {classes.map((c) => (
              <Chip key={c.id} label={`${c.code} · ${c.section}`} selected={classId === c.id} onPress={() => setClassId(c.id)} />
            ))}
          </View>
        </View>

        {questions.map((q, i) => (
          <QuestionEditor key={q.id} index={i} question={q} canRemove={questions.length > 1} onChange={change} onRemove={remove} />
        ))}

        <Button title="Add question" icon="add" variant="secondary" onPress={() => setQuestions((qs) => [...qs, blankQuestion()])} />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.actions}>
          <View style={s.flex}><Button title="Save draft" variant="secondary" onPress={() => submit(false)} /></View>
          <View style={s.flex}><Button title="Publish" onPress={() => submit(true)} /></View>
        </View>
      </Page>
    </Screen>
  );
}

const s = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  error: { fontSize: 14, color: TONES.red.strong, fontWeight: "600" },
});
