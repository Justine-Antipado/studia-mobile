// use-stats.ts — Home overview numbers, derived from the classes + submissions queries.
import { useMemo } from "react";

import { useInstructorClasses } from "@/features/instructor/hooks/use-classes";
import { useAllSubmissions } from "@/features/instructor/hooks/use-submissions";
import type { GradingGroup, InstructorStats } from "@/features/instructor/types/instructor";

export function useInstructorStats(): { data: InstructorStats | undefined; loading: boolean } {
  const classes = useInstructorClasses();
  const submissions = useAllSubmissions();

  const data = useMemo<InstructorStats | undefined>(() => {
    if (!classes.data || !submissions.data) return undefined;
    const groups = new Map<string, GradingGroup>();
    let pendingCount = 0;
    for (const s of submissions.data) {
      if (s.score !== null) continue;
      pendingCount++;
      const g = groups.get(s.quizId);
      if (!g) groups.set(s.quizId, { quizId: s.quizId, quizTitle: s.quizTitle, classCode: s.classCode, count: 1, oldestAt: s.submittedAt });
      else {
        g.count++;
        if (s.submittedAt < g.oldestAt) g.oldestAt = s.submittedAt;
      }
    }
    const nextGrading = Array.from(groups.values()).sort((a, b) => a.oldestAt.localeCompare(b.oldestAt))[0] ?? null;
    return {
      classCount: classes.data.length,
      studentCount: classes.data.reduce((n, c) => n + c.studentCount, 0),
      pendingCount,
      nextGrading,
    };
  }, [classes.data, submissions.data]);

  return { data, loading: classes.loading || submissions.loading };
}
