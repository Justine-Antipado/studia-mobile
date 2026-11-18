// // studia-colors.ts

// export const C = {
//   primaryDark: '#3B288C',
//   primary: '#5B46B6',
//   lavender: '#D6CEFA',
//   lavenderSoft: '#ECE8FC',
//   white: '#FFFFFF',
//   surface: '#F4F5F9',
//   border: '#E2E4EC',
//   muted: '#6B7280',
//   text: '#1F2438',
//   green: '#38A169',
//   greenTint: '#DFF2E6',
//   red: '#E05252',
//   orange: '#ED8936',
//   blue: '#3B82F6',
//   gold: '#F59E0B',
// };

// /** Splash screen gradient: purple (top) -> white (bottom) */
// export const SPLASH_GRADIENT = {
//   colors: [
//     'rgba(76, 52, 190, 0.88)',
//     'rgba(98, 75, 215, 0.92)',
//     'rgba(236, 232, 252, 0.97)',
//     '#F5F3FF',
//   ],
//   locations: [0, 0.5, 0.8, 1],
// } as const;
// studia-colors.ts

// export const C = {
//   primaryDark: '#3B288C',
//   primary: '#5B46B6',
//   lavender: '#D6CEFA',
//   lavenderSoft: '#ECE8FC',
//   white: '#FFFFFF',
//   surface: '#F4F5F9',
//   border: '#E2E4EC',
//   muted: '#6B7280',
//   text: '#1F2438',
//   green: '#38A169',
//   greenTint: '#DFF2E6',
//   red: '#E05252',
//   orange: '#ED8936',
//   blue: '#3B82F6',
//   gold: '#F59E0B',
// };

// /** Splash screen gradient: purple (top) -> white (bottom) */
// export const SPLASH_GRADIENT = {
//   colors: [
//     'rgba(76, 52, 190, 0.88)',
//     'rgba(98, 75, 215, 0.92)',
//     'rgba(236, 232, 252, 0.97)',
//     '#F5F3FF',
//   ],
//   locations: [0, 0.5, 0.8, 1],
// } as const;

// studia-colors.ts

export const C = {
  primaryDark: "#3B288C",
  primary: "#5B46B6",
  lavender: "#D6CEFA",
  lavenderSoft: "#ECE8FC",
  white: "#FFFFFF",
  surface: "#F4F5F9",
  border: "#E2E4EC",
  muted: "#6B7280",
  text: "#1F2438",
  green: "#38A169",
  greenTint: "#DFF2E6",
  red: "#E05252",
  orange: "#ED8936",
  blue: "#3B82F6",
  gold: "#F59E0B",
  // Solid tints. Use these instead of `${color}14` alpha hex: on Android a
  // translucent background + elevation renders a visible shadow rectangle
  // inside the card (the "box inside box" in the To Grade / Needs Grading cards).
  orangeTint: "#FDF0E3",
  redTint: "#FBE5E5",
  blueTint: "#E3EDFE",
  goldTint: "#FEF3D6",
} as const;

/**
 * Color coding (keep consistent across the app):
 *  primary = default / navigation     orange = needs your action
 *  green   = done / good result        red    = problem / low score
 *  blue    = create / info             gold   = AI / highlight
 */
export type Tone = "primary" | "orange" | "green" | "red" | "blue" | "gold";

export const TONES: Record<
  Tone,
  { fg: string; strong: string; bg: string; border: string }
> = {
  primary: {
    fg: C.primary,
    strong: C.primaryDark,
    bg: C.lavenderSoft,
    border: C.lavender,
  },
  orange: {
    fg: C.orange,
    strong: "#B45309",
    bg: C.orangeTint,
    border: "#F7D9B8",
  },
  green: { fg: C.green, strong: "#276749", bg: C.greenTint, border: "#B7E0C6" },
  red: { fg: C.red, strong: "#B42323", bg: C.redTint, border: "#F2BDBD" },
  blue: { fg: C.blue, strong: "#1D4ED8", bg: C.blueTint, border: "#BFD5FB" },
  gold: { fg: C.gold, strong: "#92400E", bg: C.goldTint, border: "#F8DD9E" },
};

/** Splash screen gradient: purple (top) -> white (bottom) */
export const SPLASH_GRADIENT = {
  colors: [
    "rgba(76, 52, 190, 0.88)",
    "rgba(98, 75, 215, 0.92)",
    "rgba(236, 232, 252, 0.97)",
    "#F5F3FF",
  ],
  locations: [0, 0.5, 0.8, 1],
} as const;
