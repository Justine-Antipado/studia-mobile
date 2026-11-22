import { advanceClock, mockNow, resetClock } from "@/core/data/mock/mock-clock";

describe("mock clock", () => {
  afterEach(resetClock);

  it("moves forward in DEV and resets", () => {
    const real = Date.now();
    advanceClock(86_400_000);
    expect(mockNow() - real).toBeGreaterThanOrEqual(86_400_000);
    resetClock();
    expect(Math.abs(mockNow() - Date.now())).toBeLessThan(50);
  });
});
