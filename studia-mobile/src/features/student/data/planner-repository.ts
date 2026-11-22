// planner-repository.ts — the student's study plan: a rolling 7-day window built from the student's
// own pending tasks plus their exam dates, stored in planner_weeks / planner_blocks / planner_exams.
import type { Result } from "@/core/data/errors/app-error";
import { RemotePlannerRepository } from "@/features/student/data/planner-remote";
import type { PlannerBlock, PlannerWeek } from "@/features/student/types/student";

export interface PlannerRepository {
  getWeek(): Promise<Result<PlannerWeek>>;
  moveBlock(blockId: string, dayIso: string, startHour: number): Promise<Result<PlannerBlock>>;
  markBlockDone(blockId: string, done: boolean): Promise<Result<PlannerBlock>>;
  addExam(title: string, dateIso: string): Promise<Result<void>>;
  regenerate(): Promise<Result<PlannerWeek>>;
}

export const plannerRepository: PlannerRepository = new RemotePlannerRepository();
