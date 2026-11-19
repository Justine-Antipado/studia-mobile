// WCAG contrast check over the palette in src/theme.js: 4.5:1 for text and
// 3:1 for the boundaries of interactive controls. The pairs below are the ones
// the stylesheet actually puts together — add a pair here whenever index.css
// starts combining two tokens in a new way. Run it with:
//
//   node scripts/check-contrast.mjs
import fs from 'node:fs';

// --- palette, read from theme.js so this can never drift from the app -------
const themeSrc = fs.readFileSync('src/theme.js', 'utf8');
const C = Object.fromEntries(
  [...themeSrc.matchAll(/^\s{2}(\w+):\s*'(#[0-9A-Fa-f]{3,8})'/gm)].map((m) => [m[1], m[2]])
);

// Tints that index.css writes as literals rather than tokens.
const LIT = {
  redTint: '#FADDDD',
  dangerBg: '#FDECEC',
  blueTint: '#DCE9FD',
  orangeTint: '#FDEBD6',
  orangeInkLiteral: '#9A5B16',
  greyTint: '#ECEEF3',
  greyInk: '#4B5563',
  warnBg: '#FDEFD9',
  warnInk: '#92530C',
  offlineInk: '#8A4B12',
  sidebarBottom: '#2A1C6E',
};

// --- maths -----------------------------------------------------------------
const bytes = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const channel = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
const luminance = (hex) => {
  const [r, g, b] = bytes(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** Flatten a translucent colour over its background, the way the browser does. */
const over = (fg, alpha, bg) => {
  const [f, b] = [bytes(fg), bytes(bg)];
  return '#' + f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('');
};

// --- the pairs index.css actually renders ----------------------------------
const TEXT = [
  ['body text on a card', C.text, C.white],
  ['body text on the page', C.text, C.surface],
  ['.muted on a card', C.muted, C.white],
  ['.muted on the page', C.muted, C.surface],
  ['.muted on lavender', C.muted, C.lavenderSoft],
  ['links / .link-btn', C.primary, C.white],
  ['links on the page background', C.primary, C.surface],
  ['.err / .field-error', C.redInk, C.white],
  ['.ok', C.greenInk, C.white],
  ['.badge-green', C.greenInk, C.greenTint],
  ['.badge-red', C.redInk, LIT.redTint],
  ['.badge-blue', C.blueInk, LIT.blueTint],
  ['.badge-grey', LIT.greyInk, LIT.greyTint],
  ['.badge-orange / .pill-warn', LIT.orangeInkLiteral, LIT.orangeTint],
  ['.badge-lav / .tab-badge', C.primaryDark, C.lavenderSoft],
  ['.btn-primary label', C.white, C.primary],
  ['.btn-soft label', C.primaryDark, C.lavenderSoft],
  ['.btn-green label', C.white, C.greenStrong],
  ['.btn-red label', C.white, C.redStrong],
  ['.btn-orange label', C.white, C.orangeStrong],
  ['.btn-ghost label', C.muted, C.white],
  ['.toast-ok text', C.white, C.primaryDark],
  ['.toast-err text', C.white, C.redStrong],
  ['.offline-banner text', LIT.offlineInk, LIT.orangeTint],
  ['.form-error text', C.redInk, LIT.redTint],
  ['.form-hint-warn text', LIT.warnInk, LIT.warnBg],
  ['.caps-hint on the glass login card', C.orangeInk, over(C.white, 0.82, C.primary)],
  ['.stat-trend.up', C.greenInk, C.white],
  ['.stat-trend.down', C.redInk, C.white],
  ['.rule-item.met', C.greenInk, C.white],
  ['.check-tile icon', C.greenInk, C.greenTint],
  ['.danger-zone heading', C.redInk, LIT.dangerBg],
  ['.nav-item label (sidebar top)', C.lavender, C.primaryDark],
  ['.nav-item label (sidebar bottom)', C.lavender, LIT.sidebarBottom],
  ['.nav-group-label (80% lavender)', over(C.lavender, 0.8, C.primaryDark), C.primaryDark],
  ['.nav-subitem (78% lavender)', over(C.lavender, 0.78, C.primaryDark), C.primaryDark],
  ['.nav-badge count', C.white, C.redStrong],
  ['.user-button email', C.lavender, LIT.sidebarBottom],
  ['.login-brand copy over the overlay', C.lavenderSoft, C.primaryDark],
  ['.tab (inactive)', C.muted, C.surface],
  ['.tab (active)', C.primaryDark, C.surface],
  ['.pager-btn.active', C.white, C.primary],
  ['.dt-table column header', C.muted, C.white],
  ['.feed-icon / .quick-link-icon', C.primary, C.lavenderSoft],
  ['.error-code', C.primary, C.lavenderSoft],
  ['.breadcrumbs link', C.muted, C.surface],
  ['.link-btn.warn', C.orangeInk, C.white],
  ['.link-danger / .user-menu-item.danger', C.redInk, C.white],
];

// Boundaries and state indicators: WCAG 1.4.11 asks for 3:1, not 4.5:1.
const NON_TEXT = [
  ['input / .btn-ghost / .pager-btn border on a card', C.borderStrong, C.white],
  ['input border on the page background', C.borderStrong, C.surface],
  ['toggle (off) ring', C.primarySoft, C.white],
  ['toggle (on) track against the page', C.primary, C.white],
  ['toggle knob against the on track', C.white, C.primary],
  ['meter fill past 85%', C.redStrong, C.lavenderSoft],
  ['focus ring', C.primary, C.surface],
];

let fail = 0;
const report = (rows, bar, heading) => {
  console.log(heading);
  for (const [name, fg, bg] of rows) {
    if (!fg || !bg) { fail++; console.log('MISSING token for ' + name); continue; }
    const r = ratio(fg, bg);
    if (r < bar) fail++;
    console.log(`${r >= bar ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  ${name}  (${fg} on ${bg})`);
  }
  console.log('');
};

report(TEXT, 4.5, '--- text, 4.5:1 bar ---');
report(NON_TEXT, 3, '--- interactive boundaries, 3:1 bar ---');
console.log(fail === 0
  ? `PASS  ${TEXT.length + NON_TEXT.length} colour pairs clear WCAG AA`
  : `${fail} pair(s) below the bar`);
process.exit(fail === 0 ? 0 : 1);
