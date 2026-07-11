// ── Z-Index Layer Registry ──
// Single source of truth for every cross-cutting z-index value.  Each
// entry is exported as a JS constant *and* injected as a CSS custom
// property by `injectLayerVars()` (called once at bootstrap).  CSS
// rules then say `z-index: var(--z-theme-buildup)` instead of magic
// numbers, so the registry can't drift apart from the stylesheet.
//
// Local-stacking-context z-indexes (e.g. `.btn-primary span { z-index: 1 }`
// to sit above its `::before` background, or the VHS internal 1/2/3/4
// stack within its own overlay system) are NOT cross-cutting; they
// stay inline.  The test for "is this cross-cutting?" — would moving
// this value affect anything outside its immediate parent? — keeps the
// registry honest.
//
// Ranges (like HTTP status codes — pick from your range, never invent
// outside it):
//
//   0–9       Background layers (canvas, grain, glass overlays)
//   10–49     Page content & navigation
//   50–99     Theme build-up overlays
//   100–199   Theme warnings & fullscreen effects
//   200–299   Transition wipes
//   300–399   Panels & sidebars (achievements)
//   400–499   Dev tools (console, tooltips)
//   500–599   Toasts, fireworks & ephemeral overlays
//   600–699   Tooltips & popovers
//   700–799   Keyboard skip link (outranks every visual layer)
//   9000+     Cursor (always on top)

// Order is registration order.  Sorted by value to make drift visible —
// a new entry that doesn't fit a range jumps out.
//
// Multiple names mapped to the same value (Z_NAV/Z_PAGE_OVERLAY = 10,
// Z_THEME_EFFECT/Z_THEME_FLASH/Z_THEME_WARNING = 100, etc.) are
// deliberate aliases — different semantic roles that happen to share a
// stacking tier.  Among siblings at the same value, document order
// decides; if a future name needs *strictly above* an existing alias,
// pick a different value, don't tweak one of the existing entries.
const LAYERS = Object.freeze({
  // ── Background (0–9) ──
  Z_CANVAS: 0,
  Z_GRAIN: 1,
  // Code-rain backdrop — above the sky canvas, below content. Deliberately
  // shares the grain tier: grain's body::after paints over the rain by
  // document order, layering its texture on top, which is the intent.
  Z_MATRIX_RAIN: 1,
  Z_PAGE_CONTENT: 2,
  Z_RAIN_GLASS: 6,
  // Linked-window edge glow — deliberately shares the rain-glass tier: a
  // soft full-height wash over content but under the nav and every overlay.
  Z_SKY_LINK_GLOW: 6,
  Z_NAV: 10,
  Z_PAGE_OVERLAY: 10,
  Z_PAPER_INK: 40,

  // ── Theme build-up (50–99) ──
  Z_THEME_BUILDUP: 50,
  Z_THEME_BUILDUP_FLASH: 51,
  Z_THEME_CLICK_GLITCH: 60,
  Z_FROZEN_CRACKLE: 65,

  // ── Theme effects (100–199) ──
  Z_THEME_EFFECT: 100,
  Z_THEME_FLASH: 100,
  Z_THEME_WARNING: 100,
  // GTA-style weapon slot — deliberately shares the theme-effect tier; a
  // top-right HUD over content, under wipes and panels.
  Z_WEAPON_HUD: 100,
  // Pop-art HUD chrome — deliberately shares the theme-effect tier; sits over
  // content, under wipes and panels.
  Z_WANTED_HUD: 100,
  // Run clock — deliberately shares the theme-effect tier; a corner HUD over
  // content, under wipes and panels.
  Z_SPEEDRUN_HUD: 100,
  // Spell accumulator — deliberately shares the theme-effect tier; a low-centre
  // HUD over content, under wipes and panels.
  Z_SPELL_HUD: 100,

  // ── Transition wipes (200–299) ──
  Z_THEME_WIPE: 200,

  // ── Panels (300–399) ──
  Z_THEME_HISTORY_HUD: 300,
  Z_PANEL: 300,

  // ── Dev tools (400–499) ──
  Z_DEV_CONSOLE: 400,
  Z_DEV_TOOLTIP: 450,

  // ── Toasts & fireworks (500–599) ──
  Z_FIREWORKS: 500,
  Z_TOAST: 500,

  // ── Tooltips & popovers (600–699) ──
  Z_TOOLTIP: 600,

  // ── Skip link (700+) ──
  // Keyboard-only affordance — must outrank every visual layer when
  // focused so it's never occluded by an open panel or toast.
  Z_SKIP_LINK: 700,

  // ── Cursor (9000+) ──
  Z_CURSOR_RING: 9998,
  Z_CURSOR: 9999,
});

// Named exports — keep the existing JS callsites happy.  New JS
// consumers may also `import { LAYERS } from "./layers.js"` and read
// any value off the frozen map.
export const Z_RAIN_GLASS = LAYERS.Z_RAIN_GLASS;
export const Z_PAPER_INK = LAYERS.Z_PAPER_INK;
export const Z_FROZEN_CRACKLE = LAYERS.Z_FROZEN_CRACKLE;
export const Z_THEME_FLASH = LAYERS.Z_THEME_FLASH;
export const Z_THEME_HISTORY_HUD = LAYERS.Z_THEME_HISTORY_HUD;
export const Z_DEV_CONSOLE = LAYERS.Z_DEV_CONSOLE;
export const Z_DEV_TOOLTIP = LAYERS.Z_DEV_TOOLTIP;
export const Z_FIREWORKS = LAYERS.Z_FIREWORKS;
export { LAYERS };

// Convert `Z_THEME_BUILDUP` → `--z-theme-buildup`.  Stays in sync with
// the constant names automatically; CSS only ever sees the kebab form.
function _cssName(jsName) {
  return "--" + jsName.toLowerCase().replace(/_/g, "-");
}

/**
 * Write every layer constant to `:root` as a CSS custom property.  Call
 * once at bootstrap before any stylesheet is consulted; values are
 * static so re-injecting is a no-op but harmless.
 */
export function injectLayerVars() {
  const root = document.documentElement.style;
  for (const [jsName, value] of Object.entries(LAYERS)) {
    root.setProperty(_cssName(jsName), String(value));
  }
}
