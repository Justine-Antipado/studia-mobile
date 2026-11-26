// use-submissions.ts — grading + gradebook.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { submissionRepository } from "@/features/instructor/data/submissions-repository";

const allKey = cacheKey("instructor", "submissions");
const quizKey = (quizId: string) => cacheKey("instructor", "quizzes", quizId, "submissions");
const itemKey = (id: string) => cacheKey("instructor", "submissions", id);

export function useAllSubmissions() {
  return useQuery(allKey, () => submissionRepository.list(), { ttlMs: TTL.live });
}

export function useQuizSubmissions(quizId: string | null) {
  return useQuery(quizId ? quizKey(quizId) : null, () => submissionRepository.listByQuiz(quizId!), {
    ttlMs: TTL.live,
    enabled: !!quizId,
  });
}

export function useSubmission(id: string | null) {
  return useQuery(id ? itemKey(id) : null, () => submissionRepository.get(id!), { ttlMs: TTL.live, enabled: !!id });
}

export function useGradeQuestion(attemptId: string) {
  return useMutation(
    ({ questionId, points }: { questionId: string; points: string }) =>
      submissionRepository.gradeQuestion(attemptId, questionId, points),
    { invalidate: () => itemKey(attemptId) },
  );
}

export function useReleaseGrade(attemptId: string) {
  return useMutation(
    ({ feedback }: { feedback: string }) => submissionRepository.release(attemptId, feedback),
    {
      invalidate: (_args, submission) => [allKey, itemKey(attemptId), quizKey(submission.quizId), cacheKey("instructor", "gradebook")],
    },
  );
}
