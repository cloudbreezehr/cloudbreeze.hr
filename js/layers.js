// ── Z-Index Layer Registry ──
// Single source of truth for all z-index values used in JavaScript.
// CSS values in main.css mirror these ranges (see comment at top of main.css).
//
// Ranges (like HTTP status codes — pick from your range, never invent outside it):
//   0–9       Background layers (canvas, grain, glass overlays)
//   10–49     Page content & navigation
//   50–99     Theme build-up overlays
//   100–199   Theme warnings & fullscreen effects
//   200–299   Transition wipes
//   300–399   Panels & sidebars (achievements)
//   400–499   Dev tools (console, tooltips)
//   500–599   Toasts, fireworks & ephemeral overlays
//   600–699   Tooltips & popovers
//   9000+     Cursor (always on top)

// ── Background ──
export const Z_RAIN_GLASS = 6;

// ── Page Content Overlays ──
export const Z_PAPER_INK = 40;

// ── Theme Effects ──
export const Z_THEME_FLASH = 100;

// ── Panels & HUDs ──
export const Z_THEME_HISTORY_HUD = 300;

// ── Dev Tools ──
export const Z_DEV_CONSOLE = 400;
export const Z_DEV_TOOLTIP = 450;

// ── Toasts & Ephemeral Overlays ──
export const Z_FIREWORKS = 500;
