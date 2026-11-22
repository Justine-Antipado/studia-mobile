// gradebook-summary.ts — pure filtering + aggregation for the gradebook screen.
// "All" overall per student is weighted BY POINTS (sum of scores / sum of max over graded items),
// so a 50-point exam counts more than a 5-point quiz.
import type { GradeEntry } from "@/features/instructor/data/gradebook-repository";

export type ItemFilter = { kind: "assignment" | "quiz"; refId: string } | null;

export const itemKey = (e: Pick<GradeEntry, "kind" | "refId">) => `${e.kind}:${e.refId}`;

export type GradeItem = { key: string; kind: GradeEntry["kind"]; refId: string; title: string; classCode: string; classId: string };

/** Distinct assignments + quizzes present in the entries, newest class first by title. */
export function itemsOf(entries: GradeEntry[]): GradeItem[] {
  const seen = new Map<string, GradeItem>();
  for (const e of entries) {
    const key = itemKey(e);
    if (!seen.has(key)) seen.set(key, { key, kind: e.kind, refId: e.refId, title: e.title, classCode: e.classCode, classId: e.classId });
  }
  return [...seen.values()].sort((a, b) => a.classCode.localeCompare(b.classCode) || a.title.localeCompare(b.title));
}

export const applyItem = (entries: GradeEntry[], filter: ItemFilter) =>
  filter ? entries.filter((e) => e.kind === filter.kind && e.refId === filter.refId) : entries;

export type Stats = { averagePercent: number | null; high: number | null; low: number | null; graded: number; pending: number; missing: number };

const pct = (e: GradeEntry) => (e.max > 0 && e.score !== null ? Math.round((e.score / e.max) * 100) : 0);

export function statsOf(entries: GradeEntry[]): Stats {
  const graded = entries.filter((e) => e.status === "graded");
  const percents = graded.map(pct);
  return {
    averagePercent: percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : null,
    high: percents.length ? Math.max(...percents) : null,
    low: percents.length ? Math.min(...percents) : null,
    graded: graded.length,
    pending: entries.filter((e) => e.status === "pending").length,
    missing: entries.filter((e) => e.status === "missing").length,
  };
}

export type StudentOverall = {
  studentId: string;
  studentName: string;
  percent: number | null;
  graded: number;
  total: number;
};

/** One row per student across the given entries (points-weighted). */
export function overallByStudent(entries: GradeEntry[]): StudentOverall[] {
  const map = new Map<string, { name: string; score: number; max: number; graded: number; total: number }>();
  for (const e of entries) {
    const row = map.get(e.studentId) ?? { name: e.studentName, score: 0, max: 0, graded: 0, total: 0 };
    row.total += 1;
    if (e.status === "graded" && e.score !== null) {
      row.score += e.score;
      row.max += e.max;
      row.graded += 1;
    }
    map.set(e.studentId, row);
  }
  return [...map.entries()]
    .map(([studentId, r]) => ({
      studentId,
      studentName: r.name,
      percent: r.max > 0 ? Math.round((r.score / r.max) * 100) : null,
      graded: r.graded,
      total: r.total,
    }))
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
}
