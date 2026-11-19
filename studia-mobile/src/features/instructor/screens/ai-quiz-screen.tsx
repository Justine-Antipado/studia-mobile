import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Button, Chip, Field, Page, PageTitle, Pill } from "@/features/instructor/components/instructor-ui";
import { addQuiz, useInstructorClasses } from "@/features/instructor/data/instructor-store";
import { type Difficulty, generateQuiz } from "@/features/instructor/logic/ai-quiz-generator";
import { OPTION_LABELS } from "@/features/instructor/logic/quiz-validation";
import type { QuizQuestion } from "@/features/instructor/types/instructor";
import { Screen } from "@/shared/components/ui/screen";
import { C, TONES } from "@/shared/constants/studia-colors";
import { useSafeBack } from "@/shared/hooks/use-safe-back";

const COUNTS = [5, 10, 15] as const;
const LEVELS: Difficulty[] = ["Easy", "Medium", "Hard"];

export default function AiQuizScreen() {
  const goBack = useSafeBack();
  const classes = useInstructorClasses();
  const [topic, setTopic] = useState("");
  const [classId, setClassId] = useState<string | null>(classes[0]?.id ?? null);
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

  const save = (publish: boolean) => {
    const res = addQuiz({ title: `AI Quiz: ${topic.trim()}`, classId, questions, source: "ai" }, publish);
    if (!res.ok) return setError(res.error);
    Alert.alert(publish ? "Quiz published" : "Draft saved", "You can find it with your other quizzes.", [{ text: "OK", onPress: goBack }]);
  };

  return (
    <Screen role="instructor">
      <Page>
        <PageTitle title="AI Quiz" subtitle="Generate questions, review them, then save." onBack={goBack} />

        <Field label="Topic" value={topic} onChangeText={setTopic} placeholder="e.g. Network security basics" maxLength={80} />

        <View style={s.group}>
          <Text style={s.label}>Class</Text>
          <View style={s.chips}>
            {classes.map((c) => (
              <Chip key={c.id} label={`${c.code} · ${c.section}`} selected={classId === c.id} onPress={() => setClassId(c.id)} />
            ))}
          </View>
        </View>

        <View style={s.group}>
          <Text style={s.label}>Number of questions</Text>
          <View style={s.chips}>
            {COUNTS.map((n) => <Chip key={n} label={String(n)} selected={count === n} onPress={() => setCount(n)} />)}
          </View>
        </View>

        <View style={s.group}>
          <Text style={s.label}>Difficulty</Text>
          <View style={s.chips}>
            {LEVELS.map((l) => <Chip key={l} label={l} selected={level === l} onPress={() => setLevel(l)} />)}
          </View>
        </View>

        <Button title={questions.length ? "Regenerate" : "Generate quiz"} icon="sparkles-outline" loading={loading} onPress={generate} />
        {error ? <Text style={s.error}>{error}</Text> : null}

        {questions.length > 0 && (
          <>
            <Text style={s.h2}>Review ({questions.length})</Text>
            {questions.map((q, i) => (
              <View key={q.id} style={s.qBox}>
                <Text style={s.qText}>{i + 1}. {q.text}</Text>
                {q.options.map((o, k) => (
                  <View key={k} style={s.optRow}>
                    <Text style={[s.opt, k === q.correctIndex && s.optOk]}>{OPTION_LABELS[k]}. {o}</Text>
                    {k === q.correctIndex ? <Pill label="Correct" tone="green" /> : null}
                  </View>
                ))}
                <Button title="Remove" icon="trash-outline" variant="danger" onPress={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))} />
              </View>
            ))}
            <View style={s.actions}>
              <View style={s.flex}><Button title="Save draft" variant="secondary" onPress={() => save(false)} /></View>
              <View style={s.flex}><Button title="Publish" onPress={() => save(true)} /></View>
            </View>
          </>
        )}
      </Page>
    </Screen>
  );
}

const s = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600", color: C.text },
  h2: { fontSize: 18, fontWeight: "700", color: C.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: { fontSize: 14, color: TONES.red.strong, fontWeight: "600" },
  qBox: { gap: 8, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  qText: { fontSize: 15, fontWeight: "700", color: C.text },
  optRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  opt: { flex: 1, fontSize: 14, color: C.muted },
  optOk: { color: TONES.green.strong, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
