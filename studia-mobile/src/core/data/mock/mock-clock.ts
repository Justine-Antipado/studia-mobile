// mock-clock.ts — the app's "now" for due / late / overdue rules.
// Production: always the real clock. In __DEV__ the Account screen can move it forward ("+1 day",
// "+1 week") so overdue, late, closed and planner states can be tested without waiting.
// The real server owns time once remote (docs/api-contract.md: never trust the client clock).
let offsetMs = 0;
const listeners = new Set<() => void>();

export function mockNow(): number {
  return Date.now() + (__DEV__ ? offsetMs : 0);
}

export function getClockOffset(): number {
  return offsetMs;
}

export function advanceClock(ms: number): void {
  if (!__DEV__) return;
  offsetMs += ms;
  listeners.forEach((l) => l());
}

export function resetClock(): void {
  offsetMs = 0;
  listeners.forEach((l) => l());
}

export function subscribeClock(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
