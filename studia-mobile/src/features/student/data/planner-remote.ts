// planner-remote.ts: the student's planner. planner_weeks / planner_blocks hold the student's own
// manual plans (and planner_exams their exam dates); a block due to an assignment or quiz is never
// stored — it is computed from the `student_tasks` view at read time, on its real due date, so
// posting a task places it on the planner without any write of its own.
import { appError, type Result } from "@/core/data/errors/app-error";
import { db, guard, must, mustOk, myId } from "@/core/data/supabase/remote";
import { taskId } from "@/features/student/data/tasks-remote";
import { taskRepository } from "@/features/student/data/tasks-repository";
import type { AddPlanInput, PlannerRepository } from "@/features/student/data/planner-repository";
import type { PlannerBlock, PlannerData, PlannerExam, PlannerPriority, TaskKind } from "@/features/student/types/student";
import { addDaysIso, clockLabel, mondayOf, toLocalIso } from "@/shared/utils/format";

/** How far back/forward "Today / Monthly / Yearly" ever needs to look. */
const RANGE_PAST_DAYS = 365;
const RANGE_FUTURE_DAYS = 365;
/** A task has no priority of its own; it shows as a medium card until the student raises it. */
const TASK_PRIORITY: PlannerPriority = "medium";

type BlockRow = {
  id: string;
  day_date: string;
  start_hour: number;
  duration_hours: number;
  title: string;
  notes: string;
  priority: PlannerPriority;
  task_kind: TaskKind | null;
  task_ref_id: string | null;
  done: boolean;
};

const BLOCK_COLUMNS = "id, day_date, start_hour, duration_hours, title, notes, priority, task_kind, task_ref_id, done";

const toBlock = (b: BlockRow): PlannerBlock => ({
  id: b.id,
  dayIso: b.day_date,
  startHour: b.start_hour,
  durationHours: b.duration_hours,
  title: b.title,
  notes: b.notes,
  priority: b.priority,
  taskId: b.task_kind && b.task_ref_id ? taskId(b.task_kind, b.task_ref_id) : null,
  // addPlan/updatePlan always write task_kind/task_ref_id as null — a manual block is never
  // task-derived — so there is no class id to carry here either.
  taskKind: null,
  taskClassId: null,
  taskRefId: null,
  done: b.done,
});

/** Finds or creates the planner_weeks row that owns `dayIso`, for inserting a manual block into. */
async function weekRowFor(me: string, dayIso: string): Promise<string> {
  const monday = mondayOf(dayIso);
  const found = must(
    await db().from("planner_weeks").select("id").eq("student_id", me).eq("week_start", monday).maybeSingle(),
  ) as { id: string } | null;
  if (found) return found.id;
  const created = must(
    await db().from("planner_weeks").insert({ student_id: me, week_start: monday }).select("id").single(),
  ) as { id: string };
  return created.id;
}

/** The student's own manual blocks whose day falls inside [startIso, endIso]. */
async function manualBlocks(me: string, startIso: string, endIso: string): Promise<PlannerBlock[]> {
  const weeks = must(
    await db()
      .from("planner_weeks")
      .select("id")
      .eq("student_id", me)
      .gte("week_start", mondayOf(startIso))
      .lte("week_start", mondayOf(endIso)),
  ) as { id: string }[];
  if (!weeks.length) return [];
  const rows = must(
    await db()
      .from("planner_blocks")
      .select(BLOCK_COLUMNS)
      .in(
        "week_id",
        weeks.map((w) => w.id),
      )
      .gte("day_date", startIso)
      .lte("day_date", endIso)
      .order("day_date")
      .order("start_hour"),
  ) as BlockRow[];
  return rows.map(toBlock);
}

/** One block per pending task due inside [startIso, endIso], auto-placed on its own due date. */
async function taskBlocks(startIso: string, endIso: string): Promise<PlannerBlock[]> {
  const result = await taskRepository.list();
  const blocks: PlannerBlock[] = [];
  for (const t of result.ok ? result.value : []) {
    const day = toLocalIso(new Date(t.dueAt));
    if (day < startIso || day > endIso) continue;
    blocks.push({
      id: t.id,
      dayIso: day,
      startHour: new Date(t.dueAt).getHours(),
      durationHours: 1,
      title: t.title,
      notes: `${t.kind === "assignment" ? "Assignment" : "Quiz"} due in ${t.classCode} · ${clockLabel(t.dueAt)}`,
      priority: TASK_PRIORITY,
      taskId: t.id,
      taskKind: t.kind,
      taskClassId: t.classId,
      taskRefId: t.refId,
      done: t.done,
    });
  }
  return blocks;
}

async function examsInRange(me: string, startIso: string, endIso: string): Promise<PlannerExam[]> {
  const rows = must(
    await db()
      .from("planner_exams")
      .select("id, title, exam_date")
      .eq("student_id", me)
      .gte("exam_date", startIso)
      .lte("exam_date", endIso)
      .order("exam_date"),
  ) as { id: string; title: string; exam_date: string }[];
  return rows.map((e) => ({ id: e.id, title: e.title, dateIso: e.exam_date }));
}

export class RemotePlannerRepository implements PlannerRepository {
  list(): Promise<Result<PlannerData>> {
    return guard(async () => {
      const me = await myId();
      const today = toLocalIso(new Date());
      const start = addDaysIso(today, -RANGE_PAST_DAYS);
      const end = addDaysIso(today, RANGE_FUTURE_DAYS);
      const [manual, auto, exams] = await Promise.all([
        manualBlocks(me, start, end),
        taskBlocks(start, end),
        examsInRange(me, start, end),
      ]);
      return {
        blocks: [...manual, ...auto].sort((a, b) => a.dayIso.localeCompare(b.dayIso) || a.startHour - b.startHour),
        exams,
      };
    });
  }

  async addPlan(input: AddPlanInput): Promise<Result<PlannerBlock>> {
    return guard(async () => {
      const me = await myId();
      const weekId = await weekRowFor(me, input.dayIso);
      const row = must(
        await db()
          .from("planner_blocks")
          .insert({
            week_id: weekId,
            day_date: input.dayIso,
            start_hour: input.startHour,
            duration_hours: input.durationHours,
            title: input.title.trim(),
            notes: input.notes.trim(),
            priority: input.priority,
            task_kind: null,
            task_ref_id: null,
            done: false,
          })
          .select(BLOCK_COLUMNS)
          .single(),
      ) as BlockRow;
      return toBlock(row);
    });
  }

  async updatePlan(blockId: string, input: AddPlanInput): Promise<Result<PlannerBlock>> {
    return guard(async () => {
      const me = await myId();
      const weekId = await weekRowFor(me, input.dayIso);
      const row = must(
        await db()
          .from("planner_blocks")
          .update({
            week_id: weekId,
            day_date: input.dayIso,
            start_hour: input.startHour,
            duration_hours: input.durationHours,
            title: input.title.trim(),
            notes: input.notes.trim(),
            priority: input.priority,
          })
          .eq("id", blockId)
          .select(BLOCK_COLUMNS)
          .maybeSingle(),
      ) as BlockRow | null;
      if (!row) throw appError("not_found", "This plan no longer exists.");
      return toBlock(row);
    }, "This plan no longer exists.");
  }

  async markBlockDone(blockId: string, done: boolean): Promise<Result<PlannerBlock>> {
    return guard(async () => {
      const row = must(
        await db().from("planner_blocks").update({ done }).eq("id", blockId).select(BLOCK_COLUMNS).maybeSingle(),
      ) as BlockRow | null;
      if (!row) throw appError("not_found", "This plan no longer exists.");
      return toBlock(row);
    }, "This plan no longer exists.");
  }

  async deleteBlock(blockId: string): Promise<Result<void>> {
    return guard(async () => {
      mustOk(await db().from("planner_blocks").delete().eq("id", blockId));
    });
  }
}
