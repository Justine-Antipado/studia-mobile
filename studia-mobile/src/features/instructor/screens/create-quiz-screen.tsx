// create-quiz-screen.tsx — manual quiz: the shared QuizForm in "create" mode.
import { useRouter } from "expo-router";

import { useToast } from "@/shared/components/ui";
import { useRouteId } from "@/core/logic/route-params";
import { QuizForm } from "@/features/instructor/components/quiz-form";
import { useCreateQuiz } from "@/features/instructor/hooks/use-quizzes";

export default function CreateQuizScreen() {
  const presetClassId = useRouteId("classId");
  const router = useRouter();
  const toast = useToast();
  const createQuiz = useCreateQuiz();

  return (
    <QuizForm
      mode="create"
      presetClassId={presetClassId}
      fallback="/instructor/assessments"
      loading={createQuiz.loading}
      onSubmit={async (draft, publish) => {
        const result = await createQuiz.run({ draft, publish });
        if (!result.ok) return { ok: false, message: result.error.message };
        toast.show(publish ? `"${result.value.title}" published` : "Draft saved", { tone: "green" });
        router.replace({ pathname: "/instructor/quiz-detail", params: { id: result.value.id } });
        return { ok: true };
      }}
    />
  );
}
