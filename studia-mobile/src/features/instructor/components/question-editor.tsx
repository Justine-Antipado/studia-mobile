// question-editor.tsx — one question in the manual quiz editor: Multiple Choice, Identification
// or Essay, each with an optional Bloom level + difficulty tag (docs/UI-BRIEF).
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionButton,
  CustomDropdown,
  FormField,
  Icon,
  toOptions,
  type DropdownOption,
} from "@/shared/components/ui";
import { C } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { ESSAY_DEFAULT_POINTS, OPTION_LABELS } from "@/features/instructor/logic/quiz-validation";
import type { BloomLevel, Difficulty, QuizQuestion, QuizQuestionType } from "@/features/instructor/types/instructor";

const TYPE_LABELS: Record<QuizQuestionType, string> = {
  multiple_choice: "Multiple Choice",
  identification: "Identification",
  essay: "Essay",
};
const TYPES: QuizQuestionType[] = ["multiple_choice", "identification", "essay"];
const BLOOM_LEVELS: BloomLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

// F4: type, Bloom level and difficulty are dropdowns instead of three chip rows per question —
// with ten questions on screen the chips were most of the form. Bloom and difficulty stay
// optional, so each list starts with "Not set", which maps back to null.
const NONE = "";
const TYPE_OPTIONS: DropdownOption<QuizQuestionType>[] = TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }));
const BLOOM_OPTIONS: DropdownOption<BloomLevel | typeof NONE>[] = [
  { value: NONE, label: "Not set" },
  ...toOptions(BLOOM_LEVELS),
];
const DIFFICULTY_OPTIONS: DropdownOption<Difficulty | typeof NONE>[] = [
  { value: NONE, label: "Not set" },
  ...toOptions(DIFFICULTIES),
];

type Props = {
  index: number;
  question: QuizQuestion;
  canRemove: boolean;
  onChange: (id: string, patch: Partial<QuizQuestion>) => void;
  onRemove: (id: string) => void;
};

function QuestionEditorBase({ index, question, canRemove, onChange, onRemove }: Props) {
  const setOption = (i: number, value: string) =>
    onChange(question.id, { options: (question.options ?? ["", "", "", ""]).map((o, k) => (k === i ? value : o)) });

  const setType = (type: QuizQuestionType) =>
    onChange(question.id, {
      type,
      options: type === "multiple_choice" ? question.options ?? ["", "", "", ""] : null,
      correctIndex: type === "multiple_choice" ? question.correctIndex ?? 0 : null,
      correctAnswer: type === "identification" ? question.correctAnswer ?? "" : null,
      // An essay is worth more than one point by default; the instructor can set any value.
      points: type === "essay" && question.points === 1 ? ESSAY_DEFAULT_POINTS : type !== "essay" && question.points === ESSAY_DEFAULT_POINTS ? 1 : question.points,
    });

  return (
    <View style={s.box}>
      <Text style={TYPE.h3}>Question {index + 1}</Text>

      <CustomDropdown label="Question type" options={TYPE_OPTIONS} value={question.type} onChange={setType} />

      <FormField
        label="Question"
        value={question.text}
        onChangeText={(text) => onChange(question.id, { text })}
        placeholder="Type the question"
        multiline
      />

      {question.type === "multiple_choice" ? (
        <View style={{ gap: SPACE.sm }}>
          <Text style={TYPE.caption}>Tap the circle to mark the correct answer.</Text>
          {(question.options ?? ["", "", "", ""]).map((opt, i) => {
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
                  <Icon name={on ? "radio-button-on" : "radio-button-off"} size={24} color={on ? C.green : C.muted} />
                </Pressable>
                <View style={s.optInput}>
                  <FormField label={`Option ${OPTION_LABELS[i]}`} value={opt} onChangeText={(v) => setOption(i, v)} placeholder={`Answer ${OPTION_LABELS[i]}`} />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {question.type === "identification" ? (
        <FormField
          label="Correct answer"
          value={question.correctAnswer ?? ""}
          onChangeText={(v) => onChange(question.id, { correctAnswer: v })}
          placeholder="Expected answer"
        />
      ) : null}

      {question.type === "essay" ? <Text style={TYPE.caption}>Essay answers are graded manually: you give the score when you check the answers.</Text> : null}

      <FormField
        label={question.type === "essay" ? "Total points for this essay" : "Points"}
        value={question.points > 0 ? String(question.points) : ""}
        onChangeText={(v) => onChange(question.id, { points: Number(v.replace(/\D/g, "").slice(0, 3)) })}
        keyboardType="number-pad"
        placeholder="1"
        maxLength={3}
      />

      <CustomDropdown
        label="Bloom level (optional)"
        options={BLOOM_OPTIONS}
        value={question.bloom ?? NONE}
        onChange={(v) => onChange(question.id, { bloom: v === NONE ? null : v })}
      />

      <CustomDropdown
        label="Difficulty (optional)"
        options={DIFFICULTY_OPTIONS}
        value={question.difficulty ?? NONE}
        onChange={(v) => onChange(question.id, { difficulty: v === NONE ? null : v })}
      />

      {canRemove ? <ActionButton label="Remove question" icon="trash-outline" variant="danger" onPress={() => onRemove(question.id)} /> : null}
    </View>
  );
}

export const QuestionEditor = memo(QuestionEditorBase);

const s = StyleSheet.create({
  box: { gap: SPACE.md, padding: SPACE.lg - 2, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  optRow: { flexDirection: "row", alignItems: "flex-end", gap: SPACE.sm },
  radio: { width: 40, height: 48, alignItems: "center", justifyContent: "center" },
  optInput: { flex: 1, minWidth: 0 },
});
