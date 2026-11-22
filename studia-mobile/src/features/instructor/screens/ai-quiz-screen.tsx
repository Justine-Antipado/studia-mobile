// ai-quiz-screen.tsx — AI Quiz Synthesizer: Multiple Choice only, tagged with Bloom + difficulty.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton, Badge, Card, Chip, FormField, PageTitle, useToast } from "@/shared/components/ui";
import { TONES } from "@/shared/constants/studia-colors";
import { Screen } from "@/shared/components/ui/screen";
import { FONT, SPACE, TYPE } from "@/shared/constants/tokens";
import { useRouteId } from "@/core/logic/route-params";
import { useUnsavedGuard } from "@/shared/hooks/use-unsaved-guard";
import { useInstructorClasses } from "@/features/instructor/hooks/use-classes";
import { useCreateQuiz } from "@/features/instructor/hooks/use-quizzes";
import { generateQuiz } from "@/features/instructor/logic/ai-quiz-generator";
import { OPTION_LABELS } from "@/features/instructor/logic/quiz-validation";
import type { Difficulty, QuizQuestion } from "@/features/instructor/types/instructor";

const MAX_QUESTIONS = 30;
const QUICK_COUNTS = [5, 10, 15, 20] as const;
const LEVELS: Difficulty[] = ["Easy", "Medium", "Hard"];

export default function AiQuizScreen() {
  const toast = useToast();
  const presetClassId = useRouteId("classId");
  const classes = useInstructorClasses();
  const createQuiz = useCreateQuiz();

  const [topic, setTopic] = useState("");
  const [classId, setClassId] = useState<string | null>(presetClassId);
  const [countText, setCountText] = useState("5");
  const [level, setLevel] = useState<Difficulty>("Medium");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { goBack, discardDialog } = useUnsavedGuard(
    "/instructor/assessments",
    topic.trim().length > 0 || questions.length > 0,
    "Discard this quiz?",
    "The generated questions have not been saved.",
  );

  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const generate = async () => {
    if (!topic.trim()) return setError("Enter a topic first.");
    const count = Number(countText);
    if (!Number.isInteger(count) || count < 1 || count > MAX_QUESTIONS) {
      return setError(`Number of questions must be a whole number from 1 to ${MAX_QUESTIONS}.`);
    }
    setError(null);
    setLoading(true);
    try {
      const result = await generateQuiz({ topic: topic.trim(), count, difficulty: level });
      if (alive.current) setQuestions(result);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Couldn't generate the quiz. Check your connection and try again.");
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
        <FormField
          label=""
          value={countText}
          onChangeText={(v) => setCountText(v.replace(/\D/g, "").slice(0, 2))}
          keyboardType="number-pad"
          maxLength={2}
          helper={`1 to ${MAX_QUESTIONS} questions`}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
          {QUICK_COUNTS.map((n) => <Chip key={n} label={String(n)} selected={countText === String(n)} onPress={() => setCountText(String(n))} />)}
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
      {discardDialog}
    </Screen>
  );
}

const s = StyleSheet.create({
  error: { color: TONES.red.strong },
  correct: { color: TONES.green.strong, fontFamily: FONT.semibold },
});
