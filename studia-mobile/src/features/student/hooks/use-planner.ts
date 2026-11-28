// use-planner.ts — the Study Planner: the student's plans + exam dates, plus tasks auto-placed on
// their due date.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import type { AddPlanInput } from "@/features/student/data/planner-repository";
import { plannerRepository } from "@/features/student/data/planner-repository";

const plannerKey = cacheKey("planner");

export function usePlanner() {
  return useQuery(plannerKey, () => plannerRepository.list(), { ttlMs: TTL.live });
}

export function useAddPlan() {
  return useMutation((args: AddPlanInput) => plannerRepository.addPlan(args), { invalidate: () => plannerKey });
}

export function useUpdatePlan() {
  return useMutation((args: { id: string } & AddPlanInput) => plannerRepository.updatePlan(args.id, args), {
    invalidate: () => plannerKey,
  });
}

export function useMarkBlockDone() {
  return useMutation((args: { id: string; done: boolean }) => plannerRepository.markBlockDone(args.id, args.done), {
    invalidate: () => plannerKey,
  });
}

export function useDeleteBlock() {
  return useMutation((id: string) => plannerRepository.deleteBlock(id), { invalidate: () => plannerKey });
}

export function useAddExam() {
  return useMutation(
    (args: { title: string; dateIso: string }) => plannerRepository.addExam(args.title, args.dateIso),
    { invalidate: () => plannerKey },
  );
}
