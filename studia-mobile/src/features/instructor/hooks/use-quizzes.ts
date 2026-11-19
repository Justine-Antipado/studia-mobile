// use-quizzes.ts — manual + AI quizzes.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { quizRepository } from "@/features/instructor/data/quizzes-repository";
import type { QuizDraft } from "@/features/instructor/types/instructor";

const quizzesKey = cacheKey("instructor", "quizzes");
const classQuizzesKey = (classId: string) => cacheKey("instructor", "classes", classId, "quizzes");

export function useQuizzes() {
  return useQuery(quizzesKey, () => quizRepository.list(), { ttlMs: TTL.live });
}

export function useClassQuizzes(classId: string | null) {
  return useQuery(classId ? classQuizzesKey(classId) : null, () => quizRepository.listByClass(classId!), {
    ttlMs: TTL.live,
    enabled: !!classId,
  });
}

export function useQuiz(id: string | null) {
  return useQuery(id ? cacheKey("instructor", "quizzes", id) : null, () => quizRepository.get(id!), {
    ttlMs: TTL.live,
    enabled: !!id,
  });
}

export function useCreateQuiz() {
  return useMutation(
    ({ draft, publish }: { draft: QuizDraft; publish: boolean }) => quizRepository.create(draft, publish),
    { invalidate: (_args, quiz) => [quizzesKey, classQuizzesKey(quiz.classId)] },
  );
}

export function useDeleteQuiz(classId: string) {
  return useMutation((id: string) => quizRepository.remove(id), {
    invalidate: (id) => [quizzesKey, classQuizzesKey(classId), cacheKey("instructor", "quizzes", id)],
  });
}
