// planner-repository.ts — the student's study plan, stored in the shared mock DB (one plan per
// student, `mockDb.planners`) instead of a module variable, so "Reset mock data" clears it and a
// second student would get their own. The plan is a rolling 7-day window built from the student's
// own pending tasks plus their exam dates.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { ME, dbId, mockDb, type DbPlanner, type DbPlannerBlock } from "@/core/data/mock/mock-db";
import { mockCall } from "@/core/data/mock/mock-latency";
import { addDaysIso, toLocalIso } from "@/shared/utils/format";
import { taskRepository } from "@/features/student/data/tasks-repository";
import type { PlannerBlock, PlannerWeek } from "@/features/student/types/student";

export interface PlannerRepository {
  getWeek(): Promise<Result<PlannerWeek>>;
  moveBlock(blockId: string, dayIso: string, startHour: number): Promise<Result<PlannerBlock>>;
  markBlockDone(blockId: string, done: boolean): Promise<Result<PlannerBlock>>;
  addExam(title: string, dateIso: string): Promise<Result<void>>;
  regenerate(): Promise<Result<PlannerWeek>>;
}

const WINDOW_DAYS = 7;
const HOURS = [16, 17, 18, 19, 20, 15, 14];

/** The planner is a rolling window: today + the next 6 days (not a calendar week). */
const windowStart = () => toLocalIso(new Date());

/**
 * Spreads one review block per pending task over the window (the evening before it is due, or
 * evenly through the window when it is due later), plus two revision blocks before each exam.
 * Hours rotate with `generation`, so Regenerate re-balances the plan instead of repeating it.
 * Finished blocks the student already ticked are kept as they are.
 */
async function generateBlocks(plan: DbPlanner, startIso: string): Promise<DbPlannerBlock[]> {
  const result = await taskRepository.list();
  const tasks = (result.ok ? result.value : []).filter((t) => !t.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const endIso = addDaysIso(startIso, WINDOW_DAYS - 1);
  const taken = new Set<string>();
  const clamp = (iso: string) => (iso < startIso ? startIso : iso > endIso ? endIso : iso);
  const gen = plan.generation;

  const place = (dayIso: string, title: string, taskId?: string): DbPlannerBlock => {
    let day = dayIso;
    let hour = -1;
    for (let spill = 0; spill < WINDOW_DAYS && hour < 0; spill++) {
      day = clamp(addDaysIso(dayIso, spill));
      const free = HOURS.map((_, k) => HOURS[(k + gen) % HOURS.length]!).find((h) => !taken.has(`${day}|${h}`));
      if (free !== undefined) hour = free;
    }
    if (hour < 0) hour = HOURS[0]!;
    taken.add(`${day}|${hour}`);
    return { id: dbId("blk"), dayIso: day, startHour: hour, durationHours: 1, title, taskId: taskId ?? null, done: false };
  };

  const blocks: DbPlannerBlock[] = [];
  tasks.slice(0, 8).forEach((task, i) => {
    const dueDay = toLocalIso(new Date(task.dueAt));
    const before = addDaysIso(dueDay, -1);
    const target = dueDay > endIso ? addDaysIso(startIso, (i + gen) % WINDOW_DAYS) : clamp(before);
    blocks.push(place(target, `Review for ${task.title}`, task.id));
  });
  plan.exams.forEach((exam) => {
    if (exam.dateIso < startIso || exam.dateIso > endIso) return;
    blocks.push(place(clamp(addDaysIso(exam.dateIso, -2)), `Revise for ${exam.title}`));
    blocks.push(place(clamp(addDaysIso(exam.dateIso, -1)), `Final review: ${exam.title}`));
  });
  return blocks;
}

/** This student's plan, rebuilt when the rolling window has moved on to a new day. */
async function ensurePlan(): Promise<DbPlanner> {
  const startIso = windowStart();
  const existing = mockDb.planners[ME.student];
  if (existing && existing.startIso === startIso) return existing;
  const base: DbPlanner = existing ?? { startIso, blocks: [], exams: [], generation: 0 };
  const plan: DbPlanner = { ...base, startIso, blocks: [] };
  plan.blocks = await generateBlocks(plan, startIso);
  mockDb.planners[ME.student] = plan;
  return plan;
}

function save(plan: DbPlanner) {
  mockDb.planners = { ...mockDb.planners, [ME.student]: plan };
  mockDb.emit();
}

/** A block whose task has since been turned in is shown as done, whatever the checkbox says. */
async function view(plan: DbPlanner): Promise<PlannerWeek> {
  const tasks = await taskRepository.list();
  const doneTasks = new Set((tasks.ok ? tasks.value : []).filter((t) => t.done).map((t) => t.id));
  return {
    weekStartIso: plan.startIso,
    exams: plan.exams,
    blocks: plan.blocks.map((b) => ({ ...b, done: b.done || (b.taskId !== null && doneTasks.has(b.taskId)) })),
  };
}

class MockPlannerRepository implements PlannerRepository {
  async getWeek(): Promise<Result<PlannerWeek>> {
    const plan = await ensurePlan();
    const week = await view(plan);
    return mockCall(() => week);
  }

  async moveBlock(blockId: string, dayIso: string, startHour: number): Promise<Result<PlannerBlock>> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const plan = await ensurePlan();
    const block = plan.blocks.find((b) => b.id === blockId);
    if (!block) return fail(appError("not_found", "This planner block no longer exists."));
    const next = { ...block, dayIso, startHour };
    save({ ...plan, blocks: plan.blocks.map((b) => (b.id === blockId ? next : b)) });
    return ok(next);
  }

  async markBlockDone(blockId: string, done: boolean): Promise<Result<PlannerBlock>> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const plan = await ensurePlan();
    const block = plan.blocks.find((b) => b.id === blockId);
    if (!block) return fail(appError("not_found", "This planner block no longer exists."));
    const next = { ...block, done };
    save({ ...plan, blocks: plan.blocks.map((b) => (b.id === blockId ? next : b)) });
    return ok(next);
  }

  async addExam(title: string, dateIso: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const plan = await ensurePlan();
    const withExam: DbPlanner = { ...plan, exams: [...plan.exams, { id: dbId("exam"), title, dateIso }] };
    // Revision blocks for the new exam are added to the plan right away.
    save({ ...withExam, blocks: await generateBlocks(withExam, withExam.startIso) });
    return ok(undefined);
  }

  async regenerate(): Promise<Result<PlannerWeek>> {
    const plan = await ensurePlan();
    const next: DbPlanner = { ...plan, startIso: windowStart(), generation: plan.generation + 1 };
    save({ ...next, blocks: await generateBlocks(next, next.startIso) });
    const week = await view(mockDb.planners[ME.student]!);
    return mockCall(() => week);
  }
}

export const plannerRepository: PlannerRepository = new MockPlannerRepository();
