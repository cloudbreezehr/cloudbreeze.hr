// ── Lights-Out Shortcut ──
// Double-tap Escape within the window clears every active theme at once.
// Requires no modifiers and skips focused inputs — the same guards used
// by all other keyboard shortcuts on the site.

import { getThemes, toggleTheme } from "./registry.js";

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

// How close together two Escape presses must be to count as a double-tap.
export const LIGHTS_OUT_WINDOW_MS = 400;

let _lastEscTime = 0;

export function initLightsOut() {
  const handler = (e) => {
    if (e.key !== "Escape") return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const tag = document.activeElement?.tagName;
    if (tag && INPUT_TAGS.has(tag)) return;
    if (document.activeElement?.isContentEditable) return;

    const now = Date.now();
    const gap = now - _lastEscTime;
    _lastEscTime = now;

    if (gap < LIGHTS_OUT_WINDOW_MS) {
      const active = getThemes().filter((m) =>
        document.body.classList.contains(m.id),
      );
      if (active.length > 0) {
        e.preventDefault();
        active.forEach((m) => toggleTheme(m.id, { silent: true }));
        // Reset so a rapid third press doesn't immediately re-trigger.
        _lastEscTime = 0;
      }
    }
  };
  document.addEventListener("keydown", handler);
  return { stop: () => document.removeEventListener("keydown", handler) };
}
