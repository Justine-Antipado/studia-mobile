// create-quiz-screen.tsx — manual quiz: Multiple Choice, Identification or Essay per question.
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton, Chip, FormField, PageTitle, useToast } from "@/shared/components/ui";
import { TONES } from "@/shared/constants/studia-colors";
import { Screen } from "@/shared/components/ui/screen";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { QuestionEditor } from "@/features/instructor/components/question-editor";
import { useInstructorClasses } from "@/features/instructor/hooks/use-classes";
import { useCreateQuiz } from "@/features/instructor/hooks/use-quizzes";
import { blankQuestion } from "@/features/instructor/logic/quiz-validation";
import type { QuizQuestion } from "@/features/instructor/types/instructor";

export default function CreateQuizScreen() {
  const goBack = useSafeBack("/instructor/assessments");
  const toast = useToast();
  const presetClassId = useRouteId("classId");
  const classes = useInstructorClasses();
  const createQuiz = useCreateQuiz();

  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState<string | null>(presetClassId);
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => [blankQuestion()]);
  const [error, setError] = useState<string | null>(null);

  const change = useCallback(
    (id: string, patch: Partial<QuizQuestion>) => setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q))),
    [],
  );
  const remove = useCallback((id: string) => setQuestions((qs) => qs.filter((q) => q.id !== id)), []);

  const submit = async (publish: boolean) => {
    const result = await createQuiz.run({ draft: { title, classId, questions, source: "manual" }, publish });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError(null);
    toast.show(publish ? `"${result.value.title}" published` : "Draft saved", { tone: "green" });
    goBack();
  };

  return (
    <Screen role="instructor" scope="instructor/create-quiz">
      <PageTitle title="Create Quiz" subtitle="Multiple choice, identification or essay." onBack={goBack} />

      <FormField label="Quiz title" value={title} onChangeText={setTitle} placeholder="e.g. Quiz 3: Risk Management" maxLength={80} />

      <View style={{ gap: SPACE.sm }}>
        <Text style={TYPE.label}>Class</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
          {(classes.data ?? []).map((c) => (
            <Chip key={c.id} label={`${c.code} · ${c.section}`} selected={classId === c.id} onPress={() => setClassId(c.id)} />
          ))}
        </View>
      </View>

      {questions.map((q, i) => (
        <QuestionEditor key={q.id} index={i} question={q} canRemove={questions.length > 1} onChange={change} onRemove={remove} />
      ))}

      <ActionButton label="Add question" icon="add" variant="secondary" onPress={() => setQuestions((qs) => [...qs, blankQuestion()])} />

      {error ? <Text style={[TYPE.body, s.error]}>{error}</Text> : null}

      <View style={{ flexDirection: "row", gap: SPACE.md }}>
        <View style={{ flex: 1 }}>
          <ActionButton label="Save draft" variant="secondary" loading={createQuiz.loading} onPress={() => submit(false)} />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton label="Publish" loading={createQuiz.loading} onPress={() => submit(true)} />
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  error: { color: TONES.red.strong },
});
