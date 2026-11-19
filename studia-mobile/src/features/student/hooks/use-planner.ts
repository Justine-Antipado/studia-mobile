// use-planner.ts — AI-generated weekly study schedule.
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useMutation } from "@/core/data/repository/use-mutation";
import { useQuery } from "@/core/data/repository/use-query";
import { plannerRepository } from "@/features/student/data/planner-repository";

const plannerKey = cacheKey("planner", "week");

export function usePlanner() {
  return useQuery(plannerKey, () => plannerRepository.getWeek(), { ttlMs: TTL.live });
}

export function useMoveBlock() {
  return useMutation(
    (args: { id: string; dayIso: string; startHour: number }) =>
      plannerRepository.moveBlock(args.id, args.dayIso, args.startHour),
    { invalidate: () => plannerKey },
  );
}

export function useMarkBlockDone() {
  return useMutation((args: { id: string; done: boolean }) => plannerRepository.markBlockDone(args.id, args.done), {
    invalidate: () => plannerKey,
  });
}

export function useAddExam() {
  return useMutation((args: { title: string; dateIso: string }) => plannerRepository.addExam(args.title, args.dateIso), {
    invalidate: () => plannerKey,
  });
}

export function useRegeneratePlanner() {
  return useMutation(() => plannerRepository.regenerate(), { invalidate: () => plannerKey });
}
