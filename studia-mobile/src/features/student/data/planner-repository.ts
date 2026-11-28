// planner-repository.ts — the student's planner: manual plans (with notes + priority), stored in
// planner_weeks / planner_blocks. A block due to an assignment or quiz is placed automatically
// (computed from student_tasks, never stored). Exam dates (planner_exams) are no longer created
// from the app — the Add Plan form's "exam" option was removed as redundant — but any already
// existing ones still display (list() below) for private.send_exam_reminders(), migration 045.
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
}

export const plannerRepository: PlannerRepository = new RemotePlannerRepository();
