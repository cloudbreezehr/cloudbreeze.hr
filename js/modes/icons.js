// ── Sub-mode Icons ──
// Minimal 16×16 geometric SVGs, one per mode.  Used by the mode history HUD
// and any other UI that wants to represent a mode visually.  Icons use
// currentColor so callers can recolor with CSS.

const ICONS = {
  frozen:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M8 1.5v13M2 8h12M3.5 3.5l9 9M12.5 3.5l-9 9"/>' +
    "</svg>",

  "deep-sea":
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M1 6c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0"/>' +
    '<path d="M1 10.5c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0"/>' +
    "</svg>",

  blocky:
    '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
    '<rect x="2" y="2" width="4" height="4"/>' +
    '<rect x="10" y="2" width="4" height="4"/>' +
    '<rect x="6" y="6" width="4" height="4"/>' +
    '<rect x="2" y="10" width="4" height="4"/>' +
    '<rect x="10" y="10" width="4" height="4"/>' +
    "</svg>",

  rainy:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M4 3l-2 4M8 3l-2 4M12 3l-2 4"/>' +
    '<path d="M3 10l-2 4M7 10l-2 4M11 10l-2 4M15 10l-2 4"/>' +
    "</svg>",

  "upside-down":
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 6l5-4 5 4"/>' +
    '<path d="M3 10l5 4 5-4"/>' +
    "</svg>",
};

const UNDISCOVERED_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
  '<circle cx="8" cy="8" r="5.5"/>' +
  '<path d="M6 7a2 2 0 014 0c0 1-.7 1.3-1.5 1.8-.4.3-.5.5-.5 1.2"/>' +
  '<circle cx="8" cy="12" r="0.5" fill="currentColor"/>' +
  "</svg>";

export function modeIcon(id) {
  return ICONS[id] || UNDISCOVERED_ICON;
}

export function undiscoveredIcon() {
  return UNDISCOVERED_ICON;
}
