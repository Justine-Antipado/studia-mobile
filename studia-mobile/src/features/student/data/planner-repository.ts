// planner-repository.ts — mock AI-generated weekly study schedule built from upcoming tasks.
// One mutable "current week" for now; a real backend would key this by weekStartIso per user.
import type { Result } from "@/core/data/errors/app-error";
import { appError, fail, ok } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import { taskRepository } from "@/features/student/data/tasks-repository";
import type { PlannerBlock, PlannerWeek } from "@/features/student/types/student";

export interface PlannerRepository {
  getWeek(): Promise<Result<PlannerWeek>>;
  moveBlock(blockId: string, dayIso: string, startHour: number): Promise<Result<PlannerBlock>>;
  markBlockDone(blockId: string, done: boolean): Promise<Result<PlannerBlock>>;
  addExam(title: string, dateIso: string): Promise<Result<void>>;
  regenerate(): Promise<Result<PlannerWeek>>;
}

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function mondayOf(date: Date): string {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Simple heuristic: one review block the evening before each task is due, spread across hours. */
async function generateBlocks(weekStartIso: string): Promise<PlannerBlock[]> {
  const result = await taskRepository.list();
  const tasks = result.ok ? result.value.filter((t) => !t.done) : [];
  const hours = [16, 17, 18, 19, 20];

  return tasks.slice(0, 6).map((task, i) => {
    const dueDay = new Date(task.dueAt).toISOString().slice(0, 10);
    const reviewDay = addDays(dueDay, -1) >= weekStartIso ? addDays(dueDay, -1) : weekStartIso;
    return {
      id: newId("blk"),
      dayIso: reviewDay,
      startHour: hours[i % hours.length]!,
      durationHours: 1,
      title: `Review for ${task.title}`,
      taskId: task.id,
      done: false,
    };
  });
}

let currentWeek: PlannerWeek | null = null;

async function ensureWeek(): Promise<PlannerWeek> {
  const weekStartIso = mondayOf(new Date());
  if (currentWeek && currentWeek.weekStartIso === weekStartIso) return currentWeek;
  currentWeek = { weekStartIso, blocks: await generateBlocks(weekStartIso), exams: [] };
  return currentWeek;
}

class MockPlannerRepository implements PlannerRepository {
  async getWeek(): Promise<Result<PlannerWeek>> {
    const week = await ensureWeek();
    return mockCall(() => week);
  }

  async moveBlock(blockId: string, dayIso: string, startHour: number): Promise<Result<PlannerBlock>> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const week = await ensureWeek();
    const block = week.blocks.find((b) => b.id === blockId);
    if (!block) return fail(appError("not_found", "This planner block no longer exists."));
    const next: PlannerBlock = { ...block, dayIso, startHour };
    currentWeek = { ...week, blocks: week.blocks.map((b) => (b.id === blockId ? next : b)) };
    return ok(next);
  }

  async markBlockDone(blockId: string, done: boolean): Promise<Result<PlannerBlock>> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const week = await ensureWeek();
    const block = week.blocks.find((b) => b.id === blockId);
    if (!block) return fail(appError("not_found", "This planner block no longer exists."));
    const next: PlannerBlock = { ...block, done };
    currentWeek = { ...week, blocks: week.blocks.map((b) => (b.id === blockId ? next : b)) };
    return ok(next);
  }

  async addExam(title: string, dateIso: string): Promise<Result<void>> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const week = await ensureWeek();
    currentWeek = { ...week, exams: [...week.exams, { id: newId("exam"), title, dateIso }] };
    return ok(undefined);
  }

  async regenerate(): Promise<Result<PlannerWeek>> {
    const weekStartIso = mondayOf(new Date());
    currentWeek = { weekStartIso, blocks: await generateBlocks(weekStartIso), exams: currentWeek?.exams ?? [] };
    return mockCall(() => currentWeek!);
  }
}

export const plannerRepository: PlannerRepository = new MockPlannerRepository();
