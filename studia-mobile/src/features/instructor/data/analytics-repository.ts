// analytics-repository.ts — Smart Analytics: engagement, content consumption, struggling
// concepts (docs/UI-BRIEF). Mock numbers now; same shape a real analytics endpoint would return.
import type { Result } from "@/core/data/errors/app-error";
import { mockCall } from "@/core/data/mock/mock-latency";
import type { AnalyticsData } from "@/features/instructor/types/instructor";

export interface AnalyticsRepository {
  get(): Promise<Result<AnalyticsData>>;
}

const DATA: AnalyticsData = {
  engagement: [
    { classCode: "IT 321", engagementPercent: 86 },
    { classCode: "IT 314", engagementPercent: 72 },
    { classCode: "IT 318", engagementPercent: 64 },
    { classCode: "IT 322", engagementPercent: 58 },
  ],
  consumption: [
    { title: "Lesson 3: Network Security Basics", classCode: "IT 321", viewRatePercent: 94 },
    { title: "Lesson 4: Cryptography Fundamentals", classCode: "IT 321", viewRatePercent: 61 },
    { title: "Lesson 6: REST APIs", classCode: "IT 314", viewRatePercent: 78 },
  ],
  struggling: [
    { concept: "Access control models", classCode: "IT 321", missRatePercent: 46 },
    { concept: "Asymmetric encryption", classCode: "IT 321", missRatePercent: 38 },
    { concept: "REST status codes", classCode: "IT 314", missRatePercent: 29 },
  ],
};

class MockAnalyticsRepository implements AnalyticsRepository {
  get(): Promise<Result<AnalyticsData>> {
    return mockCall(() => DATA);
  }
}

export const analyticsRepository: AnalyticsRepository = new MockAnalyticsRepository();
