// reveal.tsx — staggered fade + rise entrance for a screen's top-level sections (home, overview
// pages). Pass the section's position via `index` so later sections lag slightly behind earlier
// ones. Skips the motion entirely when the OS reduce-motion setting is on, same rule as Skeleton.
import type { ReactNode } from "react";
import Animated, { FadeInUp, useReducedMotion } from "react-native-reanimated";

import { DURATION } from "@/shared/constants/tokens";

const STEP_MS = 70;
const MAX_DELAY_MS = 280;

export function Reveal({ index = 0, children }: { index?: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;

  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index * STEP_MS, MAX_DELAY_MS)).duration(DURATION.base)}>
      {children}
    </Animated.View>
  );
}
