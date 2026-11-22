// analytics-repository.ts — Smart Analytics: engagement, content consumption, struggling
// concepts (docs/UI-BRIEF). Computed by the instructor_analytics() database function.
import type { Result } from "@/core/data/errors/app-error";
import { RemoteAnalyticsRepository } from "@/features/instructor/data/analytics-remote";
import type { AnalyticsData } from "@/features/instructor/types/instructor";

export interface AnalyticsRepository {
  get(): Promise<Result<AnalyticsData>>;
}

export const analyticsRepository: AnalyticsRepository = new RemoteAnalyticsRepository();
