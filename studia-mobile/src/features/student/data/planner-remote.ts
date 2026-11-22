// planner-remote.ts: the student's rolling 7-day study plan, stored in planner_weeks / planner_blocks /
// planner_exams. The plan is generated on the device from the student's pending tasks and exams
//, then persisted; it is rebuilt when the window moves to a new day.
import { appError, type Result } from "@/core/data/errors/app-error";
import { db, guard, must, mustOk, myId } from "@/core/data/supabase/remote";
import { taskId } from "@/features/student/data/tasks-remote";
import { taskRepository } from "@/features/student/data/tasks-repository";
import type { PlannerRepository } from "@/features/student/data/planner-repository";
import type { PlannerBlock, PlannerExam, PlannerWeek, TaskKind } from "@/features/student/types/student";
import { addDaysIso, toLocalIso } from "@/shared/utils/format";

const WINDOW_DAYS = 7;
const HOURS = [16, 17, 18, 19, 20, 15, 14];

type BlockRow = {
  id: string;
  day_date: string;
  start_hour: number;
  duration_hours: number;
  title: string;
  task_kind: TaskKind | null;
  task_ref_id: string | null;
  done: boolean;
};
type NewBlock = Omit<BlockRow, "id">;

const todayIso = () => toLocalIso(new Date());

/** Monday of the week containing `iso` (planner_weeks.week_start must be a Monday). */
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const back = (d.getDay() + 6) % 7;
  return addDaysIso(iso, -back);
}

const toBlock = (b: BlockRow): PlannerBlock => ({
  id: b.id,
  dayIso: b.day_date,
  startHour: b.start_hour,
  durationHours: b.duration_hours,
  title: b.title,
  taskId: b.task_kind && b.task_ref_id ? taskId(b.task_kind, b.task_ref_id) : null,
  done: b.done,
});

async function exams(me: string): Promise<PlannerExam[]> {
  const rows = must(await db().from("planner_exams").select("id, title, exam_date").eq("student_id", me).order("exam_date")) as {
    id: string;
    title: string;
    exam_date: string;
  }[];
  return rows.map((e) => ({ id: e.id, title: e.title, dateIso: e.exam_date }));
}

async function generate(startIso: string, examList: PlannerExam[], gen: number): Promise<NewBlock[]> {
  const result = await taskRepository.list();
  const tasks = (result.ok ? result.value : []).filter((t) => !t.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const endIso = addDaysIso(startIso, WINDOW_DAYS - 1);
  const taken = new Set<string>();
  const clamp = (iso: string) => (iso < startIso ? startIso : iso > endIso ? endIso : iso);

  const place = (dayIso: string, title: string, task?: { kind: TaskKind; refId: string }): NewBlock => {
    let day = dayIso;
    let hour = -1;
    for (let spill = 0; spill < WINDOW_DAYS && hour < 0; spill++) {
      day = clamp(addDaysIso(dayIso, spill));
      const free = HOURS.map((_, k) => HOURS[(k + gen) % HOURS.length]!).find((h) => !taken.has(`${day}|${h}`));
      if (free !== undefined) hour = free;
    }
    if (hour < 0) hour = HOURS[0]!;
    taken.add(`${day}|${hour}`);
    return { day_date: day, start_hour: hour, duration_hours: 1, title: title.slice(0, 140), task_kind: task?.kind ?? null, task_ref_id: task?.refId ?? null, done: false };
  };

  const blocks: NewBlock[] = [];
  tasks.slice(0, 8).forEach((task, i) => {
    const dueDay = toLocalIso(new Date(task.dueAt));
    const target = dueDay > endIso ? addDaysIso(startIso, (i + gen) % WINDOW_DAYS) : clamp(addDaysIso(dueDay, -1));
    blocks.push(place(target, `Review for ${task.title}`, { kind: task.kind, refId: task.refId }));
  });
  examList.forEach((exam) => {
    if (exam.dateIso < startIso || exam.dateIso > endIso) return;
    blocks.push(place(clamp(addDaysIso(exam.dateIso, -2)), `Revise for ${exam.title}`));
    blocks.push(place(clamp(addDaysIso(exam.dateIso, -1)), `Final review: ${exam.title}`));
  });
  return blocks;
}

async function weekRow(me: string): Promise<{ id: string; generated_at: string }> {
  const monday = mondayOf(todayIso());
  const found = must(await db().from("planner_weeks").select("id, generated_at").eq("student_id", me).eq("week_start", monday).maybeSingle()) as { id: string; generated_at: string } | null;
  if (found) return found;
  return must(await db().from("planner_weeks").insert({ student_id: me, week_start: monday }).select("id, generated_at").single()) as { id: string; generated_at: string };
}

async function rebuild(me: string, weekId: string, gen: number): Promise<void> {
  const list = await exams(me);
  const fresh = await generate(todayIso(), list, gen);
  mustOk(await db().from("planner_blocks").delete().eq("week_id", weekId));
  if (fresh.length) mustOk(await db().from("planner_blocks").insert(fresh.map((b) => ({ ...b, week_id: weekId }))));
  mustOk(await db().from("planner_weeks").update({ generated_at: new Date().toISOString() }).eq("id", weekId));
}

async function ensure(me: string, force = false, gen = 0): Promise<string> {
  const week = await weekRow(me);
  const stale = toLocalIso(new Date(week.generated_at)) !== todayIso();
  const empty = must(await db().from("planner_blocks").select("id").eq("week_id", week.id).limit(1)) as unknown[];
  if (force || stale || empty.length === 0) await rebuild(me, week.id, gen);
  return week.id;
}

async function view(me: string, weekId: string): Promise<PlannerWeek> {
  const start = todayIso();
  const end = addDaysIso(start, WINDOW_DAYS - 1);
  const rows = must(
    await db().from("planner_blocks").select("id, day_date, start_hour, duration_hours, title, task_kind, task_ref_id, done").eq("week_id", weekId).gte("day_date", start).lte("day_date", end).order("day_date").order("start_hour"),
  ) as BlockRow[];
  const tasks = await taskRepository.list();
  const doneTasks = new Set((tasks.ok ? tasks.value : []).filter((t) => t.done).map((t) => t.id));
  return {
    weekStartIso: start,
    exams: await exams(me),
    blocks: rows.map(toBlock).map((b) => ({ ...b, done: b.done || (b.taskId !== null && doneTasks.has(b.taskId)) })),
  };
}

export class RemotePlannerRepository implements PlannerRepository {
  getWeek(): Promise<Result<PlannerWeek>> {
    return guard(async () => {
      const me = await myId();
      return view(me, await ensure(me));
    });
  }

  async moveBlock(blockId: string, dayIso: string, startHour: number): Promise<Result<PlannerBlock>> {
    return guard(async () => {
      const row = must(
        await db().from("planner_blocks").update({ day_date: dayIso, start_hour: startHour }).eq("id", blockId).select("id, day_date, start_hour, duration_hours, title, task_kind, task_ref_id, done").maybeSingle(),
      ) as BlockRow | null;
      if (!row) throw appError("not_found", "This planner block no longer exists.");
      return toBlock(row);
    }, "This planner block no longer exists.");
  }

  async markBlockDone(blockId: string, done: boolean): Promise<Result<PlannerBlock>> {
    return guard(async () => {
      const row = must(
        await db().from("planner_blocks").update({ done }).eq("id", blockId).select("id, day_date, start_hour, duration_hours, title, task_kind, task_ref_id, done").maybeSingle(),
      ) as BlockRow | null;
      if (!row) throw appError("not_found", "This planner block no longer exists.");
      return toBlock(row);
    }, "This planner block no longer exists.");
  }

  async addExam(title: string, dateIso: string): Promise<Result<void>> {
    return guard(async () => {
      const me = await myId();
      mustOk(await db().from("planner_exams").insert({ student_id: me, title: title.trim(), exam_date: dateIso }));
      await ensure(me, true);
    });
  }

  async regenerate(): Promise<Result<PlannerWeek>> {
    return guard(async () => {
      const me = await myId();
      return view(me, await ensure(me, true, 1 + Math.floor(Math.random() * 6)));
    });
  }
}
