// tokens.ts — single source of truth for spacing, radius, typography, shadow, motion.
// Colors live in studia-colors.ts (C / TONES). Never hard-code these values in screens.
import { StyleSheet } from "react-native";

import { C } from "@/shared/constants/studia-colors";

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const RADIUS = { sm: 8, md: 12, lg: 14, xl: 18, xxl: 22, pill: 999 } as const;

export const FONT = {
  regular: "Poppins_400Regular",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
} as const;

/** Minimum accessible touch target (dp) and the hit slop that gets small icons there. */
export const MIN_TOUCH = 44;
export const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/** Animation durations (ms). Keep in sync with core/config/transitions.ts. */
export const DURATION = { fast: 120, base: 220, slow: 320 } as const;

export const SHADOW = {
  /** Default card lift. */
  card: {
    shadowColor: C.primaryDark,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  /** Primary buttons / floating actions. */
  raised: {
    shadowColor: C.primaryDark,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  /** Tab bar / sheets (shadow points upward). */
  bar: {
    shadowColor: C.primaryDark,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
} as const;

/** Text styles. Always pair with numberOfLines / flexShrink so fontScale cannot break layout. */
export const TYPE = StyleSheet.create({
  h1: { fontSize: 20, lineHeight: 28, color: C.text, fontFamily: FONT.bold },
  h2: { fontSize: 16, lineHeight: 24, color: C.text, fontFamily: FONT.bold },
  h3: { fontSize: 14.5, lineHeight: 20, color: C.text, fontFamily: FONT.bold },
  body: { fontSize: 14, lineHeight: 20, color: C.text, fontFamily: FONT.regular },
  bodyStrong: { fontSize: 14, lineHeight: 20, color: C.text, fontFamily: FONT.semibold },
  label: { fontSize: 12.5, lineHeight: 18, color: C.text, fontFamily: FONT.semibold },
  muted: { fontSize: 12.5, lineHeight: 18, color: C.muted, fontFamily: FONT.regular },
  caption: { fontSize: 11, lineHeight: 15, color: C.muted, fontFamily: FONT.regular },
  eyebrow: { fontSize: 11.5, lineHeight: 16, color: C.primary, fontFamily: FONT.semibold },
  button: { fontSize: 15, lineHeight: 20, fontFamily: FONT.semibold },
});
