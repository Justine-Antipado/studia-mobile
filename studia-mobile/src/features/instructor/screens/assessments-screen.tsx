// assessments-screen.tsx — Assessments tab: AI synthesizer banner, manual create, quizzes list,
// needs-grading shortcut, gradebook summary (docs/ROUTE-MAP.md).
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton, Badge, Icon, ListRow, ListState, PageTitle, SegmentedTabs, StatCard } from "@/shared/components/ui";
import { Screen } from "@/shared/components/ui/screen";
import { C } from "@/shared/constants/studia-colors";
import type { Tone } from "@/shared/constants/studia-colors";
import { SPACE } from "@/shared/constants/tokens";
import { scoreTone, timeAgo, toPercent } from "@/features/instructor/logic/format";
import { useQuizzes } from "@/features/instructor/hooks/use-quizzes";
import { useAllSubmissions } from "@/features/instructor/hooks/use-submissions";
import type { QuizStatus } from "@/features/instructor/types/instructor";

const TABS = ["Quizzes", "To Grade", "Gradebook"] as const;
type Tab = (typeof TABS)[number];
const STATUS_TONE: Record<QuizStatus, Tone> = { draft: "primary", published: "green" };
const STATUS_LABEL: Record<QuizStatus, string> = { draft: "Draft", published: "Published" };

export default function InstructorAssessmentsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Quizzes");
  const quizzes = useQuizzes();
  const submissions = useAllSubmissions();

  const pending = useMemo(
    () => (submissions.data ?? []).filter((s) => s.score === null).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)),
    [submissions.data],
  );
  const graded = useMemo(() => (submissions.data ?? []).filter((s) => s.score !== null), [submissions.data]);
  const average = graded.length
    ? Math.round(graded.reduce((sum, s) => sum + toPercent(s.score ?? 0, s.maxScore), 0) / graded.length)
    : null;

  return (
    <Screen role="instructor" scope="instructor/assessments">
      <PageTitle title="Assessments" />
      <SegmentedTabs items={TABS} value={tab} onChange={setTab} />

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

      {tab === "Gradebook" ? (
        <View style={{ gap: SPACE.lg }}>
          <View style={{ flexDirection: "row", gap: SPACE.md }}>
            <StatCard label="Average" value={average === null ? "–" : `${average}%`} tone={average === null ? "primary" : scoreTone(average)} />
            <StatCard label="Graded" value={graded.length} />
            <StatCard label="Pending" value={pending.length} tone={pending.length > 0 ? "orange" : "green"} />
          </View>
          <ActionButton label="Open full gradebook" icon="bar-chart-outline" onPress={() => router.push("/instructor/gradebook")} />
        </View>
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
