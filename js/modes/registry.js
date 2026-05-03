// ── Sub-mode Registry ──
// Each mode file declares itself via `registerMode(descriptor)` at module
// load time — metadata (label, color, icon) is available immediately, the
// toggle handler is bound later during `init` via `registerToggle`.
//
// Consumers never hardcode mode ids.  They iterate `getModes()` or look up
// a single mode via `getMode(id)`.
//
// Icons are inline SVG strings so there's no fetch step; they use
// currentColor so the caller can tint with CSS.

const _modes = new Map(); // id -> { id, label, color, icon, toggle? }
const _order = []; // insertion order = canonical render order

/**
 * Declare a mode.  Called at module-top-level from each mode file.
 *
 * @param {object} descriptor
 * @param {string} descriptor.id     Body class for the mode (e.g. "frozen").
 * @param {string} descriptor.label  Human-readable short label ("Frozen").
 * @param {string} descriptor.color  Hex accent color ("#88d4f7").
 * @param {string} descriptor.icon   Inline SVG string, 16×16 viewBox.
 */
export function registerMode(descriptor) {
  const { id } = descriptor;
  if (!id) throw new Error("registerMode: id is required");
  if (_modes.has(id)) return; // idempotent — tolerate re-imports
  _modes.set(id, { ...descriptor });
  _order.push(id);
}

/**
 * Bind the runtime toggle handler for a mode.  Called during the mode's
 * `init()` after local state (isFrozen, etc.) exists.
 */
export function registerToggle(id, toggle) {
  const m = _modes.get(id);
  if (!m) throw new Error(`registerToggle: unknown mode "${id}"`);
  m.toggle = toggle;
}

/** All registered modes in declaration order. */
export function getModes() {
  return _order.map((id) => _modes.get(id));
}

/** Canonical id list — preferred over hardcoded arrays. */
export function getModeIds() {
  return _order.slice();
}

/** Single-mode lookup. */
export function getMode(id) {
  return _modes.get(id) || null;
}

/** Toggle a mode by id.  No-op if unregistered or bind-not-called. */
export function toggleMode(id) {
  const m = _modes.get(id);
  if (m && typeof m.toggle === "function") m.toggle();
}

export function isModeRegistered(id) {
  return _modes.has(id);
}
