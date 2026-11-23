// quiz-form.tsx — the ONE form for creating and editing a manual quiz: title, class, schedule &
// rules (due, late policy, closing time, time limit) and the questions.
// When students have already taken the quiz the questions are locked (shown read-only) and only
// the title and schedule can change, mirroring the repository rule.
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Href } from "expo-router";

import {
  ActionButton,
  Card,
  Chip,
  ConfirmDialog,
  CustomDropdown,
  DateTimeField,
  FormField,
  PageTitle,
  SelectField,
  useToast,
  type DropdownOption,
} from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { TONES } from "@/shared/constants/studia-colors";
import { SPACE, TYPE } from "@/shared/constants/tokens";
import { useForceBack, useSafeBack } from "@/shared/hooks/use-safe-back";
import { QuestionEditor } from "@/features/instructor/components/question-editor";
import { useInstructorClasses } from "@/features/instructor/hooks/use-classes";
import { presetDue } from "@/features/instructor/logic/assignment-schedule";
import { defaultSchedule, parseTimeLimit, suggestedClose, validateSchedule } from "@/features/instructor/logic/quiz-schedule";
import { blankQuestion } from "@/features/instructor/logic/quiz-validation";
import type { QuizDraft, QuizQuestion, QuizStatus } from "@/features/instructor/types/instructor";

export type QuizFormInitial = {
  title: string;
  classId: string | null;
  questions: QuizQuestion[];
  dueAt: string | null;
  allowLate: boolean;
  closesAt: string | null;
  timeLimitMin: number | null;
  status: QuizStatus;
  attemptCount: number;
};

const LATE_OPTIONS = [
  { value: "blocked", label: "Not allowed", description: "The quiz closes at the due date." },
  { value: "allowed", label: "Allowed until it closes", description: "Late attempts are tagged Late until the closing time." },
] as const;

type Result = { ok: true } | { ok: false; message: string };

export function QuizForm({
  mode,
  initial,
  presetClassId,
  fallback,
  onSubmit,
  loading,
}: {
  mode: "create" | "edit";
  initial?: QuizFormInitial;
  presetClassId?: string | null;
  fallback: Href;
  onSubmit: (draft: QuizDraft, publish: boolean) => Promise<Result>;
  loading: boolean;
}) {
  const toast = useToast();
  const classes = useInstructorClasses();
  const base = useMemo(() => defaultSchedule(), []);
  const classOptions = useMemo<DropdownOption<string>[]>(
    () =>
      (classes.data ?? []).map((c) => ({
        value: c.id,
        label: `${c.code} · ${c.section}`,
        description: c.title,
      })),
    [classes.data],
  );

  const [title, setTitle] = useState(initial?.title ?? "");
  const [classId, setClassId] = useState<string | null>(initial?.classId ?? presetClassId ?? null);
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => initial?.questions ?? [blankQuestion()]);
  const [due, setDue] = useState(new Date(initial?.dueAt ?? base.dueAt!));
  const [late, setLate] = useState<"allowed" | "blocked">(initial?.allowLate ? "allowed" : "blocked");
  const [closes, setCloses] = useState<Date | null>(initial?.closesAt ? new Date(initial.closesAt) : null);
  const [limit, setLimit] = useState(initial?.timeLimitMin ? String(initial.timeLimitMin) : "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busyKind, setBusyKind] = useState<"draft" | "publish" | null>(null);

  const locked = (initial?.attemptCount ?? 0) > 0;
  const touch = () => setDirty(true);
  const goBack = useSafeBack(fallback, { blocked: dirty, onBlocked: () => setConfirmDiscard(true) });
  const forceBack = useForceBack(fallback);

  const change = useCallback((id: string, patch: Partial<QuizQuestion>) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    setDirty(true);
  }, []);
  const remove = useCallback((id: string) => {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    setDirty(true);
  }, []);

  const submit = async (publish: boolean) => {
    const parsed = parseTimeLimit(limit);
    if (!parsed.ok) return setError(parsed.error);
    const closesAt = late === "allowed" ? (closes ?? suggestedClose(due)).toISOString() : null;
    const schedule = { dueAt: due.toISOString(), allowLate: late === "allowed", closesAt, timeLimitMin: parsed.value };
    if (publish) {
      const scheduleError = validateSchedule(schedule, mode === "edit" && initial?.status === "published" ? "edit" : "create");
      if (scheduleError) return setError(scheduleError);
    }
    setError(null);
    setBusyKind(publish ? "publish" : "draft");
    const result = await onSubmit({ title, classId, questions, source: "manual", schedule }, publish);
    setBusyKind(null);
    if (!result.ok) {
      setError(result.message);
      toast.show(result.message, { tone: "red" });
    }
  };

  const published = initial?.status === "published";

  return (
    <Screen role="instructor" scope={`instructor/${mode}-quiz`}>
      <PageTitle
        title={mode === "edit" ? "Edit Quiz" : "Create Quiz"}
        subtitle="Multiple choice, identification or essay."
        onBack={goBack}
      />

      <FormField label="Quiz title" value={title} onChangeText={(v) => { setTitle(v); touch(); }} placeholder="e.g. Quiz 3: Risk Management" maxLength={80} />

      {/* F4: a dropdown, so the form stays the same height with 3 classes or 30. */}
      {mode === "create" ? (
        <CustomDropdown
          label="Class"
          placeholder="Choose a class"
          options={classOptions}
          value={classId ?? ""}
          onChange={(id) => {
            setClassId(id);
            touch();
          }}
        />
      ) : null}

      <Text style={TYPE.h2}>Schedule & rules</Text>
      <DateTimeField
        label="Due"
        value={due}
        onChange={(d) => { setDue(d); touch(); }}
        minimumDate={mode === "create" ? new Date() : undefined}
      />
      <View style={s.wrap}>
        {[1, 3, 7].map((days) => (
          <Chip key={days} label={days === 1 ? "Tomorrow" : days === 3 ? "In 3 days" : "Next week"} onPress={() => { setDue(presetDue(days)); touch(); }} />
        ))}
      </View>
      <SelectField
        label="Late attempts"
        value={late}
        options={LATE_OPTIONS}
        onChange={(v) => {
          setLate(v);
          if (v === "allowed" && !closes) setCloses(suggestedClose(due));
          touch();
        }}
      />
      {late === "allowed" ? (
        <DateTimeField
          label="Closes at"
          value={closes ?? suggestedClose(due)}
          onChange={(d) => { setCloses(d); touch(); }}
          helper="After this time the quiz no longer accepts any attempt."
        />
      ) : null}
      <FormField
        label="Time limit (minutes, optional)"
        value={limit}
        onChangeText={(v) => { setLimit(v.replace(/\D/g, "")); touch(); }}
        keyboardType="number-pad"
        maxLength={3}
        placeholder="No limit"
      />

      {locked ? (
        <Card>
          <Text style={TYPE.bodyStrong}>Questions are locked</Text>
          <Text style={TYPE.muted}>
            {`${initial?.attemptCount} student${initial?.attemptCount === 1 ? " has" : "s have"} already taken this quiz. Changing questions would invalidate their scores, so only the title and schedule can be edited.`}
          </Text>
          <Text style={[TYPE.caption, { marginTop: SPACE.xs }]}>{`${questions.length} question${questions.length === 1 ? "" : "s"}`}</Text>
        </Card>
      ) : (
        <>
          {questions.map((q, i) => (
            <QuestionEditor key={q.id} index={i} question={q} canRemove={questions.length > 1} onChange={change} onRemove={remove} />
          ))}
          <ActionButton
            label="Add question"
            icon="add"
            variant="secondary"
            onPress={() => { setQuestions((qs) => [...qs, blankQuestion()]); touch(); }}
          />
        </>
      )}

      {error ? <Text style={[TYPE.body, s.error]}>{error}</Text> : null}

      {published ? (
        <ActionButton label="Save changes" icon="checkmark" loading={loading && busyKind === "publish"} onPress={() => submit(true)} />
      ) : (
        <View style={{ flexDirection: "row", gap: SPACE.md }}>
          <View style={{ flex: 1 }}>
            <ActionButton label="Save draft" variant="secondary" loading={loading && busyKind === "draft"} onPress={() => submit(false)} />
          </View>
          <View style={{ flex: 1 }}>
            <ActionButton label="Publish" loading={loading && busyKind === "publish"} onPress={() => submit(true)} />
          </View>
        </View>
      )}

      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard your changes?"
        message="Your changes have not been saved."
        confirmLabel="Discard"
        onConfirm={() => { setConfirmDiscard(false); forceBack(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  error: { color: TONES.red.strong },
});
