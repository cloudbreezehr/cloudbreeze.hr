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

// Cached output of getActiveHooks().  Invalidated whenever the body's
// active-theme bitfield changes or a hook re-registers.  Callers can
// hold the returned array across frames; it's the same reference until
// the cache invalidates.
let _cachedActive = null;
let _cachedSig = -1;

// Compute a bitfield signature of which theme ids currently have their
// body class set.  7 themes fit in a single integer; comparison is O(1).
// classList.contains is a cheap hash lookup on the live token list, so
// the per-call cost is bounded by theme count even on cache miss.
function activeSignature() {
  const cl = document.body.classList;
  let sig = 0;
  let bit = 1;
  for (const id of getThemeIds()) {
    if (cl.contains(id)) sig |= bit;
    bit <<= 1;
  }
  return sig;
}

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
  _cachedActive = null;
  _cachedSig = -1;
}

/**
 * Snapshot of currently active themes that have registered hooks, in
 * `getThemeIds()` order. Returns plain objects; callers iterate.
 *
 * The result is cached behind a body-classList signature so the steady
 * state (no theme transitions) returns the same reference each call —
 * the render loop and pointer handlers fire this at high frequency.
 *
 * @returns {{id: string, hooks: CanvasHooks}[]}
 */
export function getActiveHooks() {
  const sig = activeSignature();
  if (sig === _cachedSig && _cachedActive !== null) return _cachedActive;
  const out = [];
  let bit = 1;
  for (const id of getThemeIds()) {
    if (sig & bit && _hooks.has(id)) {
      out.push({ id, hooks: _hooks.get(id) });
    }
    bit <<= 1;
  }
  _cachedActive = out;
  _cachedSig = sig;
  return out;
}

// Last-seen active signature for transition detection.  -1 sentinel
// matches the cache's "never computed" state so the first call always
// fires onActivate for any pre-set classes.
let _prevSig = -1;
let _prevActiveIds = new Set();

/**
 * Compare `active` (this frame's snapshot from `getActiveHooks()`)
 * against the previous call's snapshot and fire `onActivate` /
 * `onDeactivate` exactly once per transition.  Skips the diff entirely
 * when the active signature is unchanged, which is the steady-state
 * case (no theme just (de)activated).
 *
 * Contract: must be invoked immediately after `getActiveHooks()` in the
 * same synchronous tick — the short-circuit relies on `_cachedSig` from
 * that call reflecting the same body state as `active`.  A stale
 * `active` array passed without a fresh `getActiveHooks()` could fire
 * the wrong transitions.
 *
 * Deactivation needs the registered hooks for an id whose body class
 * is already gone — read directly from the internal map, bypassing the
 * body-class check that `getActiveHooks` performs.
 *
 * @param {{id: string, hooks: CanvasHooks}[]} active
 */
export function dispatchTransitions(active) {
  if (_cachedSig === _prevSig) return;
  const ids = new Set();
  for (const a of active) ids.add(a.id);
  for (const { id, hooks } of active) {
    if (!_prevActiveIds.has(id)) hooks.onActivate?.();
  }
  for (const id of _prevActiveIds) {
    if (!ids.has(id)) _hooks.get(id)?.onDeactivate?.();
  }
  _prevActiveIds = ids;
  _prevSig = _cachedSig;
}

/**
 * Test-only: drop every registered hook and clear the transition
 * tracker, so suites that exercise the registry directly (without
 * `vi.resetModules()`) don't leak state between cases.  Production
 * code never calls this.
 */
export function _resetForTests() {
  _hooks.clear();
  _cachedActive = null;
  _cachedSig = -1;
  _prevActiveIds = new Set();
  _prevSig = -1;
}
