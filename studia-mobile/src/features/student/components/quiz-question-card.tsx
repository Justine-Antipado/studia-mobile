// quiz-question-card.tsx — one question, used both while taking a quiz and on the result/review
// screen (mode="review" adds the correct-answer highlight + instant rationale).
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge, Card, FormField, Icon } from "@/shared/components/ui";
import { C, type Tone } from "@/shared/constants/studia-colors";
import { RADIUS, SPACE, TYPE } from "@/shared/constants/tokens";
import type { QuizAnswer, QuizQuestion } from "@/features/student/types/student";

type Props = {
  index: number;
  question: QuizQuestion;
  value: string | number | null;
  onChange?: (response: string | number | null) => void;
  mode: "take" | "review";
};

function optionTone(mode: Props["mode"], optionIndex: number, question: QuizQuestion, value: string | number | null): Tone | null {
  if (mode !== "review" || question.type !== "multiple_choice") return null;
  if (optionIndex === question.correctIndex) return "green";
  if (optionIndex === value) return "red";
  return null;
}

export const QuizQuestionCard = memo(function QuizQuestionCard({ index, question, value, onChange, mode }: Props) {
  const reviewing = mode === "review";

  return (
    <Card>
      <View style={s.head}>
        <Text style={TYPE.label}>Question {index + 1} · {question.points} pts</Text>
        {question.difficulty ? <Badge label={question.difficulty} tone="blue" /> : null}
      </View>
      <Text style={[TYPE.h3, s.prompt]}>{question.prompt}</Text>

      {question.type === "multiple_choice" && question.options ? (
        <View style={s.options}>
          {question.options.map((label, i) => {
            const tone = optionTone(mode, i, question, value);
            const selected = value === i;
            return (
              <Pressable
                key={i}
                disabled={reviewing}
                onPress={() => onChange?.(i)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                style={[
                  s.option,
                  selected && !tone && s.optionSelected,
                  tone === "green" && s.optionCorrect,
                  tone === "red" && s.optionWrong,
                ]}
              >
                <Icon
                  name={selected ? "radio-button-on" : "radio-button-off"}
                  size="sm"
                  color={tone === "green" ? C.green : tone === "red" ? C.red : selected ? C.primary : C.muted}
                />
                <Text style={[TYPE.body, s.optionText]} numberOfLines={3}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {question.type === "identification" ? (
        <FormField
          label="Your answer"
          value={typeof value === "string" ? value : ""}
          onChangeText={(t) => onChange?.(t)}
          editable={!reviewing}
          maxLength={200}
        />
      ) : null}

      {question.type === "essay" ? (
        <FormField
          label="Your answer"
          value={typeof value === "string" ? value : ""}
          onChangeText={(t) => onChange?.(t)}
          editable={!reviewing}
          multiline
          maxLength={4000}
        />
      ) : null}

      {reviewing && question.rationale ? (
        <View style={s.rationale}>
          <Text style={TYPE.label}>Rationale</Text>
          <Text style={TYPE.muted}>{question.rationale}</Text>
          {question.type === "identification" && question.correctAnswer ? (
            <Text style={[TYPE.muted, s.answer]}>Correct answer: {question.correctAnswer}</Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
});

export const emptyAnswer = (question: QuizQuestion): QuizAnswer => ({ questionId: question.id, response: null });

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  prompt: { marginTop: SPACE.xs },
  options: { gap: SPACE.sm, marginTop: SPACE.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm + 2,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  optionSelected: { borderColor: C.primary, backgroundColor: C.lavenderSoft },
  optionCorrect: { borderColor: C.green, backgroundColor: C.greenTint },
  optionWrong: { borderColor: C.red, backgroundColor: C.redTint },
  optionText: { flex: 1 },
  rationale: { marginTop: SPACE.md, gap: 4, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: C.border },
  answer: { fontFamily: "Poppins_600SemiBold" },
});
