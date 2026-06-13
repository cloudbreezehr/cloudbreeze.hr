// ── Cloudlog SVG icons ──
// Single source of truth for the icons reused across the achievement
// UI, so a stroke-width or proportion change lands in one place.

// Unlocked achievement — the default cloud-check mark.
export const CLOUD_CHECK_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M11.5 12H5C3.3 12 2 10.7 2 9c0-1.5 1-2.7 2.4-3C4.7 4.4 6.2 3 8 3c1.3 0 2.4.6 3.1 1.6.3-.1.6-.1.9-.1 1.7 0 3 1.3 3 3 0 1.5-1.1 2.8-2.5 3"/>
  <path d="M6 10l2 2 3-3.5"/>
</svg>`;

// Locked achievement — faded cloud without the checkmark.
export const CLOUD_LOCK_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
  <path d="M11.5 12H5C3.3 12 2 10.7 2 9c0-1.5 1-2.7 2.4-3C4.7 4.4 6.2 3 8 3c1.3 0 2.4.6 3.1 1.6.3-.1.6-.1.9-.1 1.7 0 3 1.3 3 3 0 1.5-1.1 2.8-2.5 3"/>
</svg>`;

// Hidden achievement — faded cloud marked with a question glyph.
export const CLOUD_HIDDEN_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
  <path d="M11.5 12H5C3.3 12 2 10.7 2 9c0-1.5 1-2.7 2.4-3C4.7 4.4 6.2 3 8 3c1.3 0 2.4.6 3.1 1.6.3-.1.6-.1.9-.1 1.7 0 3 1.3 3 3 0 1.5-1.1 2.8-2.5 3"/>
  <text x="8" y="10" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-family="monospace">?</text>
</svg>`;

// Overflow trigger — horizontal three-dot "more options" glyph.
export const MENU_DOTS_SVG = `<svg viewBox="0 0 16 16" fill="currentColor" stroke="none">
  <circle cx="3.4" cy="8" r="1.3"/>
  <circle cx="8" cy="8" r="1.3"/>
  <circle cx="12.6" cy="8" r="1.3"/>
</svg>`;

// Export — arrow descending into a tray (save state to a file).
export const EXPORT_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 2.5v6.5"/>
  <path d="M5.3 6.3 8 9l2.7-2.7"/>
  <path d="M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11"/>
</svg>`;

// Import — arrow rising out of a tray (load state from a file).
export const IMPORT_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 9V2.5"/>
  <path d="M5.3 5.2 8 2.5l2.7 2.7"/>
  <path d="M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11"/>
</svg>`;

// Hide from navbar — the cloud mark struck through with a slash.
export const HIDE_NAVBAR_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M11.5 12H5C3.3 12 2 10.7 2 9c0-1.5 1-2.7 2.4-3C4.7 4.4 6.2 3 8 3c1.3 0 2.4.6 3.1 1.6.3-.1.6-.1.9-.1 1.7 0 3 1.3 3 3 0 1.5-1.1 2.8-2.5 3"/>
  <path d="M3 13.5 13 3.5"/>
</svg>`;
