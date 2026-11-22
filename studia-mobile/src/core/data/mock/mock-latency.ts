// mock-latency.ts — shared by every mock repository so loading/error/retry states are real
// even before a backend exists. The failure rate only applies in __DEV__.
import { appError, fail, ok, type Result } from "@/core/data/errors/app-error";

/** 0..1 — exercises error/retry UI. Set at runtime from Account > Dev tools (DEV only).
 *  Starts from EXPO_PUBLIC_MOCK_FAILURE (e.g. 0.3) so it can be set without editing source. */
const envRate = Number(process.env.EXPO_PUBLIC_MOCK_FAILURE ?? 0);
let failureRate = Number.isFinite(envRate) ? Math.min(1, Math.max(0, envRate)) : 0;

export const getFailureRate = () => failureRate;
export const setFailureRate = (rate: number) => {
  failureRate = Math.min(1, Math.max(0, rate));
};

export function simulateLatency(minMs = 220, maxMs = 520): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/** Wrap a mock repository read/write: adds latency, then randomly fails in __DEV__. */
export async function mockCall<T>(produce: () => T): Promise<Result<T>> {
  await simulateLatency();
  if (__DEV__ && Math.random() < failureRate) {
    return fail(appError("network", "Could not reach the server. Check your connection.", true));
  }
  return ok(produce());
}
