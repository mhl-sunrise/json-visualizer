/**
 * Application-wide configuration constants.
 * Centralising these keeps layout/zoom tuning in one place.
 */

/** Diagram layout geometry (in SVG user units). */
export const LAYOUT = Object.freeze({
  CHAR_W: 7.3,      // approx width of a monospace glyph at 12px
  PAD_X: 15,        // horizontal padding inside a node
  HEAD_H: 30,       // node header height
  ROW_H: 26,        // height of each key/value row
  COL_GAP: 64,      // horizontal gap between depth columns
  V_GAP: 24,        // vertical gap between sibling subtrees
  MIN_WIDTH: 130,   // minimum node width
  MAX_VALUE: 42,    // truncate values longer than this
  RADIUS: 8,        // node corner radius
});

/** Pan/zoom behaviour. */
export const ZOOM = Object.freeze({
  MIN: 0.12,
  MAX: 3,
  STEP: 1.2,        // button zoom multiplier
  WHEEL: 1.1,       // wheel zoom multiplier
  FIT_MAX: 1.4,     // never zoom past this when fitting
  FIT_PADDING: 100, // padding around content when fitting
});

/** Debounce for re-parsing while typing (ms). */
export const PARSE_DEBOUNCE = 120;

/** Sidebar resize bounds (percent of workspace width). */
export const SIDEBAR = Object.freeze({ MIN: 15, MAX: 60, DEFAULT: 25 });

/** localStorage keys. */
export const STORAGE = Object.freeze({
  THEME: 'jd-theme',
  SIDEBAR: 'jd-sidebar',
});

/** Theme colours mirrored to the browser chrome (<meta name="theme-color">). */
export const THEME_COLOR = Object.freeze({ dark: '#0d1117', light: '#f6f8fa' });

/** Responsive breakpoint — must match the CSS media query. */
export const MOBILE_BREAKPOINT = 720;

/** Service worker script path. */
export const SW_PATH = 'sw.js';

/** Sample document loaded on first paint and via the "Sample" button. */
export const SAMPLE = Object.freeze({
  name: 'JSON Diagram',
  version: 1.2,
  active: true,
  tags: ['editor', 'visualizer', 'json'],
  author: { name: 'Martin', email: 'martin@develoris.com', verified: true },
  settings: { theme: 'dark', zoom: 1, autoFit: false },
  nodes: [
    { id: 1, type: 'object', children: 3 },
    { id: 2, type: 'array', children: 0 },
  ],
  meta: null,
});
