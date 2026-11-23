// gradebook-summary.ts — pure filtering + aggregation for the gradebook screen.
// "All" overall per student is weighted BY POINTS (sum of scores / sum of max over graded items),
// so a 50-point exam counts more than a 5-point quiz.
import type { GradeEntry } from "@/features/instructor/data/gradebook-repository";

// The per-item filter (ItemFilter / itemsOf / applyItem) was removed with the gradebook filter it
// served (F1): the Assessments tab and the grading queue are where a single assignment is opened.
export type Stats = { averagePercent: number | null; graded: number; pending: number; missing: number };

const pct = (e: GradeEntry) => (e.max > 0 && e.score !== null ? Math.round((e.score / e.max) * 100) : 0);

export function statsOf(entries: GradeEntry[]): Stats {
  const graded = entries.filter((e) => e.status === "graded");
  const percents = graded.map(pct);
  return {
    averagePercent: percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : null,
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
