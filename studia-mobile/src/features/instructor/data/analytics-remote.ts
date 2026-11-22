// analytics-remote.ts: Smart Analytics computed by the instructor_analytics() database function from
// real views, submissions, attempts and answers (engagement = active in the last 14 days).
import type { Result } from "@/core/data/errors/app-error";
import { db, guard, must } from "@/core/data/supabase/remote";
import type { AnalyticsRepository } from "@/features/instructor/data/analytics-repository";
import type { AnalyticsData } from "@/features/instructor/types/instructor";

export class RemoteAnalyticsRepository implements AnalyticsRepository {
  get(): Promise<Result<AnalyticsData>> {
    return guard(async () => {
      const d = must(await db().rpc("instructor_analytics")) as Partial<AnalyticsData> | null;
      return { engagement: d?.engagement ?? [], consumption: d?.consumption ?? [], struggling: d?.struggling ?? [] };
    });
  }
}
