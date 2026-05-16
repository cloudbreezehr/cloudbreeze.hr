// ── Theme Registry ──
// Two-stage design, separated to avoid module-init ordering fragility:
//
//   1. Metadata (id, label, color, icon) — declared as static data in the
//      THEMES array below.  Available unconditionally at import time, no
//      side effects, so any consumer can read it regardless of whether
//      any theme's init has run.
//
//   2. Runtime toggle handler — bound during each theme's `initXxx()` via
//      `registerToggle`.  Genuinely can't exist earlier because it closes
//      over per-theme local state (isFrozen, isSubmerged, ...).
//
// To add a new theme: add a descriptor entry to THEMES, then in the theme's
// `initXxx()` call `registerToggle(id, () => ...)`.  The behavior lives
// in the theme file; the metadata lives here.
//
// Icons are inline SVG strings so there's no fetch step; they use
// currentColor so callers can tint them with CSS.

const THEMES = [
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
    id: "paper",
    label: "Paper",
    color: "#5a4030",
    icon:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M10 3l3 3-7 7H3v-3z"/>' +
      '<path d="M9 4l3 3"/>' +
      "</svg>",
  },
  {
    id: "vhs",
    label: "VHS",
    color: "#b4f0b4",
    icon:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="2" y="4" width="12" height="8" rx="1"/>' +
      '<circle cx="6" cy="8" r="1.3" fill="currentColor"/>' +
      '<circle cx="10" cy="8" r="1.3" fill="currentColor"/>' +
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

const _byId = new Map(THEMES.map((m) => [m.id, m]));
const _toggles = new Map();

// Frozen so callers can keep the reference across calls instead of
// paying for a fresh allocation each time.  Mutation attempts throw —
// that's deliberate, the registry is the single source of truth.
const _themeIds = Object.freeze(THEMES.map((m) => m.id));

/**
 * Bind the runtime toggle handler for a theme.  Called during the theme's
 * `init()` after local state (isFrozen, etc.) exists.
 */
export function registerToggle(id, toggle) {
  if (!_byId.has(id)) throw new Error(`registerToggle: unknown theme "${id}"`);
  _toggles.set(id, toggle);
}

/** All themes in declaration order.  Returns a defensive copy. */
export function getThemes() {
  return THEMES.slice();
}

/**
 * Canonical id list — preferred over hardcoded arrays.  Returns a stable
 * frozen reference; callers may keep it across frames.
 */
export function getThemeIds() {
  return _themeIds;
}

/** Single-theme lookup.  Returns null if the id isn't known. */
export function getTheme(id) {
  return _byId.get(id) || null;
}

/**
 * Toggle a theme by id.  No-op if the toggle hasn't been bound yet.
 *
 * @param {string} id
 * @param {{silent?: boolean}} [opts]
 *   `silent: true` marks the toggle as programmatic, so deactivation
 *   doesn't award the exit achievement — that reward is reserved for
 *   users who discover the original exit gesture.
 */
export function toggleTheme(id, opts) {
  const fn = _toggles.get(id);
  if (typeof fn === "function") fn(opts);
}

export function isThemeRegistered(id) {
  return _byId.has(id);
}

/**
 * True if any registered theme other than the listed ones has its body class
 * set.  Themes whose indicators drive a canvas CSS filter use this to back
 * off when another theme's filter is already active — without each theme file
 * having to hardcode the list of competitors.
 *
 * @param {...string} exceptIds  Ids to ignore (typically the caller's own).
 */
export function hasActiveThemeExcept(...exceptIds) {
  for (const m of THEMES) {
    if (exceptIds.includes(m.id)) continue;
    if (document.body.classList.contains(m.id)) return true;
  }
  return false;
}
