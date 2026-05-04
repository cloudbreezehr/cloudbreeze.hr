// ── Sub-mode Registry ──
// Two-stage design, separated to avoid module-init ordering fragility:
//
//   1. Metadata (id, label, color, icon) — declared as static data in the
//      MODES array below.  Available unconditionally at import time, no
//      side effects.  Consumers like the achievement panel and HUD can
//      read it regardless of whether any mode's init has run.
//
//   2. Runtime toggle handler — bound during each mode's `initXxx()` via
//      `registerToggle`.  Genuinely can't exist earlier because it closes
//      over per-mode local state (isFrozen, isSubmerged, ...).
//
// To add a new mode: add a descriptor entry to MODES, then in the mode's
// `initXxx()` call `registerToggle(id, () => ...)`.  The behavior lives
// in the mode file; the metadata lives here.
//
// Icons are inline SVG strings so there's no fetch step; they use
// currentColor so callers can tint them with CSS.

const MODES = [
  {
    id: "frozen",
    label: "Frozen",
    color: "#88d4f7",
    icon:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M8 1.5v13M2 8h12M3.5 3.5l9 9M12.5 3.5l-9 9"/>' +
      "</svg>",
  },
  {
    id: "deep-sea",
    label: "Deep Sea",
    color: "#00ffc8",
    icon:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M1 6c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0"/>' +
      '<path d="M1 10.5c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0"/>' +
      "</svg>",
  },
  {
    id: "blocky",
    label: "Blocky",
    color: "#ffa040",
    icon:
      '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
      '<rect x="2" y="2" width="4" height="4"/>' +
      '<rect x="10" y="2" width="4" height="4"/>' +
      '<rect x="6" y="6" width="4" height="4"/>' +
      '<rect x="2" y="10" width="4" height="4"/>' +
      '<rect x="10" y="10" width="4" height="4"/>' +
      "</svg>",
  },
  {
    id: "rainy",
    label: "Rainy",
    color: "#6a9fc0",
    icon:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M4 3l-2 4M8 3l-2 4M12 3l-2 4"/>' +
      '<path d="M3 10l-2 4M7 10l-2 4M11 10l-2 4M15 10l-2 4"/>' +
      "</svg>",
  },
  {
    id: "upside-down",
    label: "Upside Down",
    color: "#e04050",
    icon:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 6l5-4 5 4"/>' +
      '<path d="M3 10l5 4 5-4"/>' +
      "</svg>",
  },
];

const _byId = new Map(MODES.map((m) => [m.id, m]));
const _toggles = new Map();

/**
 * Bind the runtime toggle handler for a mode.  Called during the mode's
 * `init()` after local state (isFrozen, etc.) exists.
 */
export function registerToggle(id, toggle) {
  if (!_byId.has(id)) throw new Error(`registerToggle: unknown mode "${id}"`);
  _toggles.set(id, toggle);
}

/** All modes in declaration order. */
export function getModes() {
  return MODES.slice();
}

/** Canonical id list — preferred over hardcoded arrays. */
export function getModeIds() {
  return MODES.map((m) => m.id);
}

/** Single-mode lookup.  Returns null if the id isn't known. */
export function getMode(id) {
  return _byId.get(id) || null;
}

/** Toggle a mode by id.  No-op if the toggle hasn't been bound yet. */
export function toggleMode(id) {
  const fn = _toggles.get(id);
  if (typeof fn === "function") fn();
}

export function isModeRegistered(id) {
  return _byId.has(id);
}
