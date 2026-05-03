// ── Sub-mode Registry ──
// Two jobs:
//   1. Shared metadata (id order, labels, accent colors) so multiple UIs
//      don't re-declare MODE_COLORS / MODE_LABELS / SUBMODES in parallel.
//   2. Runtime toggle lookup — modes call `registerMode` during init to
//      expose a toggle handler; consumers call `toggleMode(id)` without
//      knowing anything about the mode's internal state or trigger.
//
// The toggle handler is the same code the "force hits 1.0" path invokes —
// pressing it from outside produces an identical transition.  Modes are
// free to ignore calls (e.g. if a transition is in flight).

// Canonical order for sub-modes.  Iterate this when rendering lists.
export const SUBMODE_IDS = [
  "frozen",
  "deep-sea",
  "blocky",
  "rainy",
  "upside-down",
];

export const SUBMODE_LABELS = {
  frozen: "Frozen",
  "deep-sea": "Deep Sea",
  blocky: "Blocky",
  rainy: "Rainy",
  "upside-down": "Upside Down",
};

// Accent colors for UI chrome (HUD icons, dev-console section borders).
// Distinct from the sky palette overrides in colors.js, which are used by
// the canvas render loop.
export const SUBMODE_COLORS = {
  frozen: "#88d4f7",
  "deep-sea": "#00ffc8",
  blocky: "#ffa040",
  rainy: "#6a9fc0",
  "upside-down": "#e04050",
};

const _modes = new Map();

/**
 * Register a mode's toggle handler.  Called once per mode during init.
 *
 * @param {string}   id       Body class for the mode (e.g. "frozen").
 * @param {object}   handlers
 * @param {Function} handlers.toggle  Flips the mode on ↔ off.  Must
 *                                    dispatch the usual mode-activate /
 *                                    mode-deactivate achievement events.
 */
export function registerMode(id, handlers) {
  _modes.set(id, handlers);
}

/**
 * Toggle a mode by id.  No-op if the mode isn't registered (yet) or the
 * mode's internal guards reject the call.
 */
export function toggleMode(id) {
  const m = _modes.get(id);
  if (m && typeof m.toggle === "function") m.toggle();
}

export function isModeRegistered(id) {
  return _modes.has(id);
}
