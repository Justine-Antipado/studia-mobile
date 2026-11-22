// dev-tools.tsx — DEV-only helpers for testing the mock flows end to end (render under __DEV__).
//   - Simulate time: move the app's clock forward to exercise overdue / late / closed states.
//   - Failure rate: make mock calls fail to exercise error + retry UI.
//   - Reset mock data: restore the seed.
import { useState, useSyncExternalStore } from "react";

import { advanceClock, getClockOffset, resetClock, subscribeClock } from "@/core/data/mock/mock-clock";
import { mockDb } from "@/core/data/mock/mock-db";
import { getFailureRate, setFailureRate } from "@/core/data/mock/mock-latency";
import { clearAllCaches } from "@/core/logic/sign-out";
import { ListRow } from "@/shared/components/ui/list-row";
import { useToast } from "@/shared/components/ui/toast";

const DAY = 86_400_000;
const RATES = [0, 0.25, 0.5, 1] as const;

const offsetLabel = (ms: number) => {
  if (ms === 0) return "Real time";
  const days = Math.round(ms / DAY);
  return `+${days} day${days === 1 ? "" : "s"} ahead`;
};

export function DevTools() {
  const toast = useToast();
  const offset = useSyncExternalStore(subscribeClock, getClockOffset, getClockOffset);
  const [rate, setRate] = useState(getFailureRate());

  // Cached screens would still show the old "now"; refetch so labels and statuses recompute.
  const refresh = () => void clearAllCaches();

  const cycleRate = () => {
    const next = RATES[(RATES.findIndex((r) => r === rate) + 1) % RATES.length] ?? 0;
    setFailureRate(next);
    setRate(next);
    toast.show(next === 0 ? "Mock failures off" : `Mock calls fail ${Math.round(next * 100)}% of the time`, { tone: "green" });
  };

  return (
    <>
      <ListRow
        icon="time-outline"
        title="Simulate time: +1 day"
        subtitle={offsetLabel(offset)}
        onPress={() => {
          advanceClock(DAY);
          refresh();
        }}
      />
      <ListRow
        icon="calendar-outline"
        title="Simulate time: +1 week"
        subtitle="Test overdue, late and closed"
        onPress={() => {
          advanceClock(7 * DAY);
          refresh();
        }}
      />
      <ListRow
        icon="return-up-back-outline"
        title="Reset clock"
        subtitle="Back to the real time"
        onPress={() => {
          resetClock();
          refresh();
        }}
      />
      <ListRow
        icon="flash-outline"
        title="Mock failure rate"
        subtitle={rate === 0 ? "Off — tap to cycle 25 / 50 / 100%" : `${Math.round(rate * 100)}% of mock calls fail`}
        onPress={cycleRate}
      />
      <ListRow
        icon="refresh-outline"
        title="Reset mock data"
        subtitle="Restore the seeded classes, assignments and submissions"
        onPress={() => {
          mockDb.reset();
          resetClock();
          refresh();
        }}
      />
    </>
  );
}
