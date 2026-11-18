import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Field } from "@/features/instructor/components/instructor-ui";
import { OPTION_LABELS } from "@/features/instructor/logic/quiz-validation";
import type { QuizQuestion } from "@/features/instructor/types/instructor";
import { C } from "@/shared/constants/studia-colors";

type Props = {
  index: number;
  question: QuizQuestion;
  canRemove: boolean;
  onChange: (id: string, patch: Partial<QuizQuestion>) => void;
  onRemove: (id: string) => void;
};

function QuestionEditorBase({ index, question, canRemove, onChange, onRemove }: Props) {
  const setOption = (i: number, value: string) =>
    onChange(question.id, { options: question.options.map((o, k) => (k === i ? value : o)) });

  return (
    <View style={s.box}>
      <Text style={s.title}>Question {index + 1}</Text>
      <Field
        label="Question"
        value={question.text}
        onChangeText={(text) => onChange(question.id, { text })}
        placeholder="Type the question"
        multiline
      />
      <Text style={s.hint}>Tap the circle to mark the correct answer.</Text>
      {question.options.map((opt, i) => {
        const on = question.correctIndex === i;
        return (
          <View key={i} style={s.optRow}>
            <Pressable
              onPress={() => onChange(question.id, { correctIndex: i })}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Mark option ${OPTION_LABELS[i]} as correct`}
              hitSlop={8}
              style={s.radio}
            >
              <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={24} color={on ? C.green : C.muted} />
            </Pressable>
            <View style={s.optInput}>
              <Field label={`Option ${OPTION_LABELS[i]}`} value={opt} onChangeText={(v) => setOption(i, v)} placeholder={`Answer ${OPTION_LABELS[i]}`} />
            </View>
          </View>
        );
      })}
      {canRemove ? <Button title="Remove question" icon="trash-outline" variant="danger" onPress={() => onRemove(question.id)} /> : null}
    </View>
  );
}

export const QuestionEditor = memo(QuestionEditorBase);

const s = StyleSheet.create({
  box: { gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  title: { fontSize: 16, fontWeight: "700", color: C.primaryDark },
  hint: { fontSize: 13, color: C.muted },
  optRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  radio: { width: 40, height: 48, alignItems: "center", justifyContent: "center" },
  optInput: { flex: 1, minWidth: 0 },
});
