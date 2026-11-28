// planner-repository.ts — the student's planner: manual plans (with notes + priority) and exam
// dates the student adds, stored in planner_weeks / planner_blocks / planner_exams. A block due to
// an assignment or quiz is placed automatically (computed from student_tasks, never stored).
import type { Result } from "@/core/data/errors/app-error";
import { RemotePlannerRepository } from "@/features/student/data/planner-remote";
import type { PlannerBlock, PlannerData, PlannerPriority } from "@/features/student/types/student";

export type AddPlanInput = {
  dayIso: string;
  title: string;
  notes: string;
  priority: PlannerPriority;
  startHour: number;
  durationHours: number;
};

export interface PlannerRepository {
  list(): Promise<Result<PlannerData>>;
  addPlan(input: AddPlanInput): Promise<Result<PlannerBlock>>;
  updatePlan(blockId: string, input: AddPlanInput): Promise<Result<PlannerBlock>>;
  markBlockDone(blockId: string, done: boolean): Promise<Result<PlannerBlock>>;
  deleteBlock(blockId: string): Promise<Result<void>>;
  /** Also drops two revision blocks (2 days and 1 day before) that fall today or later. */
  addExam(title: string, dateIso: string): Promise<Result<void>>;
}

export const plannerRepository: PlannerRepository = new RemotePlannerRepository();
