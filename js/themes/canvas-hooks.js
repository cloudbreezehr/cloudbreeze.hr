// ── Canvas Hooks Registry ──
// Each theme that has canvas-side rendering, input handling, or cleanup
// registers a hooks object here. The render loop iterates active themes
// (those whose body class is set) and calls whichever subset of hooks
// each theme implements — uniform pass instead of per-theme branching.
//
// Three draw phases run in fixed order within a frame:
//
//   drawAmbient    — particles owned by the theme; runs after the
//                    atmosphere layer, before the interaction trail
//   drawForeground — runs after interactions; for visuals that must
//                    sit on top of click trails (e.g. paper's sketched
//                    horizon, which would otherwise be overdrawn)
//   drawPost       — composites on top of every other layer
//                    (post-process effects: pixelation, phosphor decay)
//
// Suppress flags are read once before the phases run; multiple themes
// raising the same flag is OR'd, since "skip this layer" doesn't have a
// meaningful conflict.
//
// Within a phase, hooks fire in `getThemeIds()` order. Two themes
// registering the same phase have a deterministic order; today that
// happens to match the only existing dependency (blocky's pixelation
// must run before vhs's phosphor capture, and blocky precedes vhs in
// THEMES). If a future theme breaks that coincidence, this registry
// will grow an explicit priority field — keep it implicit until then.
//
// Activation/deactivation hooks fire on body-class transitions, detected
// each frame by diffing the active-id set against the previous frame's.
// Programmatic toggles, user gestures, and theme-stacking all flow
// through the same path.

import { getThemeIds } from "./registry.js";

/**
 * @typedef {Object} FrameState
 * @property {number} sp                Scroll progress 0..1.
 * @property {number} dt                Seconds since the previous frame.
 * @property {number} scrollVelocity    Already decayed for this frame.
 * @property {number} drawVelocity      0 under reduced motion, else scrollVelocity.
 * @property {object} pal               Winning theme's palette (last-triggered-wins).
 * @property {(id: string) => object} palFor   Per-theme palette resolver.
 * @property {boolean} isDark
 * @property {boolean} reducedMotion
 * @property {object} forces            Shared interaction-force object.
 * @property {CanvasRenderingContext2D} ctx
 * @property {HTMLCanvasElement} canvas
 */

/**
 * @typedef {Object} PointerCtx
 * @property {number} x        Raw client x (pre canvasY mirror for upside-down).
 * @property {number} y        Raw client y.
 * @property {number} cx       Canvas-space x.
 * @property {number} cy       Canvas-space y (post canvasY mirror).
 * @property {boolean} [trailAdded]  onDragMove only — true when the trail
 *                                   accepted this point (rate-limited).
 * @property {object} forces
 * @property {(id: string) => object} palFor   Per-theme palette resolver
 *                                              (for themes drawing themed
 *                                              click visuals).
 */

/**
 * @typedef {Object} CanvasHooks
 * @property {boolean} [suppressSky]
 *   Skip the sky gradient and stars layer for this frame.
 * @property {boolean} [suppressAtmosphere]
 *   Skip atmosphere.draw (clouds, wisps, motes, gusts, horizon).
 * @property {boolean} [suppressDefaultClickBurst]
 *   Skip the default interactions click-burst — the theme draws its own.
 *
 * @property {(s: FrameState) => void} [drawAmbient]
 * @property {(s: FrameState) => void} [drawForeground]
 * @property {(s: FrameState) => void} [drawPost]
 *
 * @property {(p: PointerCtx) => void} [onClick]
 * @property {(p: PointerCtx) => void} [onDragStart]
 * @property {(p: PointerCtx) => void} [onDragMove]
 * @property {(p: PointerCtx) => void} [onDragEnd]
 *
 * @property {() => void} [onActivate]
 *   Fires the frame the theme's body class appears.
 * @property {() => void} [onDeactivate]
 *   Fires the frame the theme's body class disappears. Use for canvas-side
 *   teardown (clearing DOM ink elements, releasing capture buffers, etc.).
 */

const _hooks = new Map();

/**
 * Register canvas-side hooks for a theme. Idempotent within a session —
 * later registrations replace earlier ones, which keeps test re-init
 * predictable.
 *
 * Throws on an unknown id: the registry only iterates `getThemeIds()`,
 * so a typo would register hooks that never run, with no symptom besides
 * a silent visual no-op for the theme.
 *
 * @param {string} id
 * @param {CanvasHooks} hooks
 */
export function registerCanvasHooks(id, hooks) {
  if (!getThemeIds().includes(id)) {
    throw new Error(`registerCanvasHooks: unknown theme "${id}"`);
  }
  _hooks.set(id, hooks);
}

/**
 * Snapshot of currently active themes that have registered hooks, in
 * `getThemeIds()` order. Returns plain objects; callers iterate.
 *
 * @returns {{id: string, hooks: CanvasHooks}[]}
 */
export function getActiveHooks() {
  const out = [];
  const cl = document.body.classList;
  for (const id of getThemeIds()) {
    if (cl.contains(id) && _hooks.has(id)) {
      out.push({ id, hooks: _hooks.get(id) });
    }
  }
  return out;
}

// Invariant: `_prevActiveIds` mirrors the set of theme ids whose
// `onActivate` has fired without a matching `onDeactivate`.  Mutated
// only by `dispatchTransitions`.
let _prevActiveIds = new Set();

/**
 * Compare `active` (this frame's snapshot from `getActiveHooks()`)
 * against the previous call's snapshot and fire `onActivate` /
 * `onDeactivate` exactly once per transition.
 *
 * Deactivation needs the registered hooks for an id whose body class
 * is already gone — read directly from the internal map, bypassing the
 * body-class check that `getActiveHooks` performs.
 *
 * @param {{id: string, hooks: CanvasHooks}[]} active
 */
export function dispatchTransitions(active) {
  const ids = new Set(active.map((a) => a.id));
  for (const { id, hooks } of active) {
    if (!_prevActiveIds.has(id)) hooks.onActivate?.();
  }
  for (const id of _prevActiveIds) {
    if (!ids.has(id)) _hooks.get(id)?.onDeactivate?.();
  }
  _prevActiveIds = ids;
}

/**
 * Test-only: drop every registered hook and clear the transition
 * tracker, so suites that exercise the registry directly (without
 * `vi.resetModules()`) don't leak state between cases.  Production
 * code never calls this.
 */
export function _resetForTests() {
  _hooks.clear();
  _prevActiveIds = new Set();
}
