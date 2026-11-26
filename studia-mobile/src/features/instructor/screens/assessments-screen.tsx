// assessments-screen.tsx — Assessments tab: AI synthesizer banner, manual create, quizzes list,
// needs-grading shortcut (docs/ROUTE-MAP.md). Per-class grades live on the class's own Grades tab.
import { useSafeRouter } from "@/shared/hooks/use-safe-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton, Badge, Icon, ListRow, ListState, PageTitle, HorizontalChipBar } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import type { Tone } from "@/shared/constants/studia-colors";
import { SPACE } from "@/shared/constants/tokens";
import { timeAgo } from "@/features/instructor/logic/format";
import { useQuizzes } from "@/features/instructor/hooks/use-quizzes";
import { useAllSubmissions } from "@/features/instructor/hooks/use-submissions";
import type { QuizStatus } from "@/features/instructor/types/instructor";

const TABS = ["Quizzes", "To Grade"] as const;
type Tab = (typeof TABS)[number];
const STATUS_TONE: Record<QuizStatus, Tone> = { draft: "primary", published: "green" };
const STATUS_LABEL: Record<QuizStatus, string> = { draft: "Draft", published: "Published" };

export default function InstructorAssessmentsScreen() {
  const router = useSafeRouter();
  const [tab, setTab] = useState<Tab>("Quizzes");
  const quizzes = useQuizzes();
  const submissions = useAllSubmissions();

  const pending = useMemo(
    () => (submissions.data ?? []).filter((s) => s.score === null).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)),
    [submissions.data],
  );

  return (
    <Screen role="instructor" scope="instructor/assessments">
      <PageTitle title="Assessments" />
      <HorizontalChipBar items={TABS} value={tab} onChange={setTab} label="Sections" />

      {tab === "Quizzes" ? (
        <View style={{ gap: SPACE.lg }}>
          <View style={s.banner}>
            <View style={s.badge}>
              <Icon name="sparkles" size="xs" color={C.white} />
              <Text style={s.badgeText}>AI Quiz Synthesizer</Text>
            </View>
            <Text style={s.bannerTitle}>Generate a quiz from a lesson</Text>
            <Text style={s.bannerSub}>Pick a topic, question count and difficulty</Text>
            <ActionButton label="Start synthesizer" variant="secondary" onPress={() => router.push("/instructor/ai-quiz")} />
          </View>

          <ActionButton label="Create Quiz Manually" icon="add" onPress={() => router.push("/instructor/create-quiz")} />

          <ListState
            loading={quizzes.loading}
            error={quizzes.error}
            onRetry={quizzes.refetch}
            empty={!quizzes.loading && (quizzes.data ?? []).length === 0}
            emptyIcon="help-circle-outline"
            emptyTitle="No quizzes yet"
          >
            <View style={{ gap: SPACE.md }}>
              {(quizzes.data ?? []).map((q) => (
                <ListRow
                  key={q.id}
                  icon="document-text-outline"
                  eyebrow={q.classCode}
                  title={q.title}
                  subtitle={`${q.questions.length} item${q.questions.length === 1 ? "" : "s"}`}
                  trailing={<Badge label={STATUS_LABEL[q.status]} tone={STATUS_TONE[q.status]} />}
                  onPress={() => router.push({ pathname: "/instructor/quiz-detail", params: { id: q.id } })}
                />
              ))}
            </View>
          </ListState>
        </View>
      ) : null}

      {tab === "To Grade" ? (
        <ListState
          loading={submissions.loading}
          error={submissions.error}
          onRetry={submissions.refetch}
          empty={!submissions.loading && pending.length === 0}
          emptyIcon="checkmark-done-outline"
          emptyTitle="All caught up"
          emptyMessage="Every submission has been graded."
        >
          <View style={{ gap: SPACE.md }}>
            {pending.map((x) => (
              <ListRow
                key={x.id}
                icon="document-text-outline"
                iconBg="#FDF0E3"
                iconColor={C.orange}
                eyebrow={`${x.classCode} · ${x.quizTitle}`}
                title={x.studentName}
                subtitle={`Submitted ${timeAgo(x.submittedAt)}`}
                onPress={() => router.push({ pathname: "/instructor/grade-submission", params: { id: x.id } })}
              />
            ))}
          </View>
        </ListState>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: C.primaryDark, borderRadius: 22, padding: 18, gap: 10 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.16)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: C.white, fontSize: 11, fontFamily: "Poppins_600SemiBold" },
  bannerTitle: { color: C.white, fontSize: 18, fontFamily: "Poppins_700Bold" },
  bannerSub: { color: C.lavender, fontSize: 12.5, fontFamily: "Poppins_400Regular", marginBottom: 4 },
});
