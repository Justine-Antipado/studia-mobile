// studia-colors — same palette as the mobile app (JS version of studia-colors.ts)
export const C = {
  primaryDark: '#3B288C',
  primary: '#5B46B6',
  primarySoft: '#7B66D6',
  lavender: '#D6CEFA',
  lavenderSoft: '#ECE8FC',
  white: '#FFFFFF',
  surface: '#F4F5F9',
  border: '#E2E4EC',
  muted: '#616775',
  text: '#1F2438',
  green: '#38A169',
  greenTint: '#DFF2E6',
  red: '#E05252',
  orange: '#ED8936',
  blue: '#3B82F6',
  gold: '#F59E0B',

  /* ---- Accessible 'ink' variants (phase 8 contrast pass) -------------------
     The hues above stay as-is for fills, charts and tints; these darker
     variants are what text, icons and solid buttons use, so every pair clears
     WCAG AA 4.5:1. Measured ratios are in docs/admin-progress.md (phase 8). */
  greenInk: '#27734A',
  redInk: '#A83B3B',
  orangeInk: '#8F5220',
  blueInk: '#2B61BA',
  greenStrong: '#2B7F52',
  redStrong: '#C24444',
  orangeStrong: '#A75F25',
  /* Boundary colour for interactive controls (inputs, ghost buttons, pager):
     3:1 against both white and --surface, per WCAG 1.4.11 non-text contrast. */
  borderStrong: '#8B89A3',
};

/** Splash / login gradient: purple (top) -> white (bottom) */
export const SPLASH_GRADIENT =
  'linear-gradient(180deg, rgba(76,52,190,0.88) 0%, rgba(98,75,215,0.92) 50%, rgba(236,232,252,0.97) 80%, #F5F3FF 100%)';

/**
 * DESIGN TOKENS — spacing, radius, shadow, z-index and motion.
 * Nothing in a page may hard-code a hex, a pixel step or a duration: use
 * var(--space-4), var(--radius-md), var(--shadow-card), var(--motion-base)…
 */
export const SPACE = { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 7: '32px', 8: '40px', 9: '56px' };

export const RADIUS = { sm: '8px', md: '12px', lg: '16px', xl: '20px', pill: '999px' };

export const SHADOW = {
  card: '0 2px 10px rgba(59, 40, 140, 0.06)',
  raised: '0 8px 24px rgba(59, 40, 140, 0.10)',
  pop: '0 16px 40px rgba(59, 40, 140, 0.16)',
  glass: '0 24px 60px rgba(31, 20, 80, 0.28)',
  focus: '0 0 0 3px rgba(91, 70, 182, 0.25)',
};

export const Z = { base: '1', sticky: '20', dropdown: '40', drawer: '60', backdrop: '70', modal: '80', toast: '90' };

export const MOTION = {
  fast: '120ms',
  base: '220ms',
  slow: '360ms',
  ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
};

export const TYPE = {
  h1: '24px',
  h2: '19px',
  h3: '15px',
  body: '14px',
  small: '12px',
  tiny: '11px',
};

/** Layout constants shared by the CSS and the Sidebar component. */
export const LAYOUT = { sidebar: '264px', sidebarCollapsed: '76px', topbar: '64px', content: '1440px' };

const kebab = (key) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Push the palette and the tokens into CSS variables so index.css can use them. */
export function applyThemeVars(root = document.documentElement) {
  const set = (name, value) => root.style.setProperty(name, value);

  Object.entries(C).forEach(([k, v]) => set(`--${kebab(k)}`, v));
  Object.entries(SPACE).forEach(([k, v]) => set(`--space-${k}`, v));
  Object.entries(RADIUS).forEach(([k, v]) => set(`--radius-${k}`, v));
  Object.entries(SHADOW).forEach(([k, v]) => set(`--shadow-${k}`, v));
  Object.entries(Z).forEach(([k, v]) => set(`--z-${k}`, v));
  Object.entries(MOTION).forEach(([k, v]) => set(`--motion-${k}`, v));
  Object.entries(TYPE).forEach(([k, v]) => set(`--type-${k}`, v));
  Object.entries(LAYOUT).forEach(([k, v]) => set(`--layout-${kebab(k)}`, v));
}
