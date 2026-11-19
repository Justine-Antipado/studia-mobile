// mock-latency.ts — shared by every mock repository so loading/error/retry states are real
// even before a backend exists. MOCK_FAILURE_RATE only applies in __DEV__.
import { appError, fail, ok, type Result } from "@/core/data/errors/app-error";

/** 0..1 — raise this locally to exercise error/retry UI. Never on in production builds. */
export const MOCK_FAILURE_RATE = 0;

export function simulateLatency(minMs = 220, maxMs = 520): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/** Wrap a mock repository read/write: adds latency, then randomly fails in __DEV__. */
export async function mockCall<T>(produce: () => T): Promise<Result<T>> {
  await simulateLatency();
  if (__DEV__ && Math.random() < MOCK_FAILURE_RATE) {
    return fail(appError("network", "Could not reach the server. Check your connection.", true));
  }
  return ok(produce());
}
