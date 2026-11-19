// use-analytics.ts — Smart Analytics (engagement, consumption, struggling concepts).
import { cacheKey } from "@/core/data/cache/cache-keys";
import { TTL } from "@/core/data/cache/query-cache";
import { useQuery } from "@/core/data/repository/use-query";
import { analyticsRepository } from "@/features/instructor/data/analytics-repository";

const analyticsKey = cacheKey("instructor", "analytics");

export function useAnalytics() {
  return useQuery(analyticsKey, () => analyticsRepository.get(), { ttlMs: TTL.live });
}
