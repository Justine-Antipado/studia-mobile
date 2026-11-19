// ai-quiz-screen.tsx — AI Quiz Synthesizer: Multiple Choice only, tagged with Bloom + difficulty.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton, Badge, Card, Chip, FormField, PageTitle, useToast } from "@/shared/components/ui";
import { TONES } from "@/shared/constants/studia-colors";
import { Screen } from "@/shared/components/ui/screen";
import { FONT, SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteId } from "@/core/logic/route-params";
import { useSafeBack } from "@/shared/hooks/use-safe-back";
import { useInstructorClasses } from "@/features/instructor/hooks/use-classes";
import { useCreateQuiz } from "@/features/instructor/hooks/use-quizzes";
import { generateQuiz } from "@/features/instructor/logic/ai-quiz-generator";
import { OPTION_LABELS } from "@/features/instructor/logic/quiz-validation";
import type { Difficulty, QuizQuestion } from "@/features/instructor/types/instructor";

const COUNTS = [5, 10, 15] as const;
const LEVELS: Difficulty[] = ["Easy", "Medium", "Hard"];

export default function AiQuizScreen() {
  const goBack = useSafeBack("/instructor/assessments");
  const toast = useToast();
  const presetClassId = useRouteId("classId");
  const classes = useInstructorClasses();
  const createQuiz = useCreateQuiz();

  const [topic, setTopic] = useState("");
  const [classId, setClassId] = useState<string | null>(presetClassId);
  const [count, setCount] = useState<number>(5);
  const [level, setLevel] = useState<Difficulty>("Medium");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const generate = async () => {
    if (!topic.trim()) return setError("Enter a topic first.");
    setError(null);
    setLoading(true);
    try {
      const result = await generateQuiz({ topic: topic.trim(), count, difficulty: level });
      if (alive.current) setQuestions(result);
    } catch {
      if (alive.current) setError("Couldn't generate the quiz. Check your connection and try again.");
    } finally {
      if (alive.current) setLoading(false);
    }
  };

  const save = async (publish: boolean) => {
    const result = await createQuiz.run({
      draft: { title: `AI Quiz: ${topic.trim()}`, classId, questions, source: "ai" },
      publish,
    });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.show(publish ? "Quiz published" : "Draft saved", { tone: "green" });
    goBack();
  };

  return (
    <Screen role="instructor" scope="instructor/ai-quiz">
      <PageTitle title="AI Quiz" subtitle="Generate questions, review them, then save." onBack={goBack} />

      <FormField label="Topic" value={topic} onChangeText={setTopic} placeholder="e.g. Network security basics" maxLength={80} />

      <View style={{ gap: SPACE.sm }}>
        <Text style={TYPE.label}>Class</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
          {(classes.data ?? []).map((c) => (
            <Chip key={c.id} label={`${c.code} · ${c.section}`} selected={classId === c.id} onPress={() => setClassId(c.id)} />
          ))}
        </View>
      </View>

      <View style={{ gap: SPACE.sm }}>
        <Text style={TYPE.label}>Number of questions</Text>
        <View style={{ flexDirection: "row", gap: SPACE.sm }}>
          {COUNTS.map((n) => <Chip key={n} label={String(n)} selected={count === n} onPress={() => setCount(n)} />)}
        </View>
      </View>

      <View style={{ gap: SPACE.sm }}>
        <Text style={TYPE.label}>Difficulty</Text>
        <View style={{ flexDirection: "row", gap: SPACE.sm }}>
          {LEVELS.map((l) => <Chip key={l} label={l} selected={level === l} onPress={() => setLevel(l)} />)}
        </View>
      </View>

      <ActionButton label={questions.length ? "Regenerate" : "Generate quiz"} icon="sparkles-outline" loading={loading} onPress={generate} />
      {error ? <Text style={[TYPE.body, s.error]}>{error}</Text> : null}

      {questions.length > 0 ? (
        <>
          <Text style={TYPE.h2}>Review ({questions.length})</Text>
          {questions.map((q, i) => (
            <Card key={q.id}>
              <View style={{ gap: SPACE.sm }}>
                <Text style={TYPE.bodyStrong}>{i + 1}. {q.text}</Text>
                <View style={{ flexDirection: "row", gap: SPACE.sm }}>
                  {q.bloom ? <Badge label={q.bloom} tone="primary" /> : null}
                  {q.difficulty ? <Badge label={q.difficulty} tone="blue" /> : null}
                </View>
                {(q.options ?? []).map((o, k) => (
                  <View key={k} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm }}>
                    <Text style={[TYPE.body, k === q.correctIndex && s.correct]}>
                      {OPTION_LABELS[k]}. {o}
                    </Text>
                    {k === q.correctIndex ? <Badge label="Correct" tone="green" /> : null}
                  </View>
                ))}
                <ActionButton label="Remove" icon="trash-outline" variant="danger" onPress={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))} />
              </View>
            </Card>
          ))}
          <View style={{ flexDirection: "row", gap: SPACE.md }}>
            <View style={{ flex: 1 }}>
              <ActionButton label="Save draft" variant="secondary" loading={createQuiz.loading} onPress={() => save(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton label="Publish" loading={createQuiz.loading} onPress={() => save(true)} />
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  error: { color: TONES.red.strong },
  correct: { color: TONES.green.strong, fontFamily: FONT.semibold },
});
