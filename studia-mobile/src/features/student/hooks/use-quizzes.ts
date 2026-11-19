// use-quizzes.ts — quiz list/detail + submitting an attempt.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { quizRepository } from "@/features/student/data/quizzes-repository";
import type { QuizAnswer } from "@/features/student/types/student";

export function useQuizzes(classId: string | null) {
  return useQuery(classId ? cacheKey("quizzes", classId) : null, () => quizRepository.listByClass(classId!), {
    ttlMs: TTL.live,
    enabled: !!classId,
  });
}

export function useQuiz(classId: string | null, id: string | null) {
  return useQuery(classId && id ? cacheKey("quiz", classId, id) : null, () => quizRepository.get(classId!, id!), {
    ttlMs: TTL.live,
    enabled: !!classId && !!id,
  });
}

export function useSubmitQuizAttempt(classId: string, quizId: string) {
  return useMutation((answers: QuizAnswer[]) => quizRepository.submitAttempt(classId, quizId, answers), {
    invalidate: () => [cacheKey("quiz", classId, quizId), cacheKey("quizzes", classId), cacheKey("tasks")],
  });
}
